import type { AppDb } from '../db/app-db';
import type { Scope } from './scopes';
import { newKey, newKeyId } from './token';

/** A key as its owner and the console see it. Times are epoch ms. */
export type ApiKeyView = {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  createdAt: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

/** What verification needs: the row, its hash, and its owner's ban (Better Auth's columns). */
export type StoredKey = ApiKeyView & { userId: string; hash: Buffer; banned: boolean; banExpires: number | null };

export type KeyActor = { type: 'user' | 'admin'; id: string };

type Row = Omit<ApiKeyView, 'scopes'> & { scopes: string };
type OwnedRow = Row & { userId: string; hash: Buffer; banned: number | null; banExpires: string | null };

const COLUMNS = `k.key_id AS id, k.name, k.prefix, k.scopes, k.created_at AS createdAt, k.expires_at AS expiresAt,
  k.last_used_at AS lastUsedAt, k.revoked_at AS revokedAt`;

const view = ({ scopes, ...row }: Row): ApiKeyView => ({ ...row, scopes: JSON.parse(scopes) as Scope[] });

/** The api_key table. Creation and revocation write their audit_event in the same transaction. */
export function keyStore(db: AppDb) {
  const insert = db.prepare(`
    INSERT INTO api_key (key_id, user_id, name, prefix, key_hash, scopes, created_at, expires_at)
    VALUES (@id, @userId, @name, @prefix, @hash, @scopes, @createdAt, @expiresAt)`);
  const ofUser = db.prepare(`SELECT ${COLUMNS} FROM api_key k WHERE k.user_id = ? ORDER BY k.created_at DESC, k.key_id`);
  const live = db.prepare(`SELECT ${COLUMNS} FROM api_key k WHERE k.key_id = ? AND k.user_id = ? AND k.revoked_at IS NULL`);
  const activeCount = db.prepare(`
    SELECT count(*) FROM api_key WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`).pluck();
  const markRevoked = db.prepare('UPDATE api_key SET revoked_at = ? WHERE key_id = ?');
  // The join also refuses keys whose owner is gone.
  const byHash = db.prepare(`
    SELECT ${COLUMNS}, k.user_id AS userId, k.key_hash AS hash, u.banned, u.banExpires
    FROM api_key k JOIN auth_user u ON u.id = k.user_id WHERE k.key_hash = ?`);
  const touch = db.prepare('UPDATE api_key SET last_used_at = ? WHERE key_id = ?');
  const audit = db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
    VALUES (?, ?, ?, ?, 'user', ?, ?)`);

  const record = (at: number, actor: KeyActor, action: string, userId: string, data: object) =>
    audit.run(at, actor.type, actor.id, action, userId, JSON.stringify(data));

  return {
    /** Every key the user has, newest first; revoked ones only when asked. */
    list(userId: string, { revoked = false } = {}) {
      return (ofUser.all(userId) as Row[]).map(view).filter(key => revoked || key.revokedAt === null);
    },

    /** The full key is returned here and never again; null when the user already has `max` active keys. */
    create(p: { userId: string; name: string; scopes: Scope[]; expiresAt: number | null; max: number; at: number }) {
      return db.transaction(() => {
        if ((activeCount.get(p.userId, p.at) as number) >= p.max) return null;
        const { key, hash, prefix } = newKey();
        const row = { id: newKeyId(), userId: p.userId, name: p.name, prefix, hash, scopes: JSON.stringify(p.scopes), createdAt: p.at, expiresAt: p.expiresAt };
        insert.run(row);
        record(p.at, { type: 'user', id: p.userId }, 'apikey.create', p.userId, { keyId: row.id, prefix, name: p.name, scopes: p.scopes, expiresAt: p.expiresAt });
        const created: ApiKeyView = { id: row.id, name: p.name, prefix, scopes: p.scopes, createdAt: p.at, expiresAt: p.expiresAt, lastUsedAt: null, revokedAt: null };
        return { ...created, key };
      })();
    },

    /** Null when the user has no such unrevoked key. */
    revoke(userId: string, keyId: string, actor: KeyActor, at: number) {
      return db.transaction(() => {
        const row = live.get(keyId, userId) as Row | undefined;
        if (!row) return null;
        markRevoked.run(at, keyId);
        record(at, actor, 'apikey.revoke', userId, { keyId, prefix: row.prefix, name: row.name });
        return view({ ...row, revokedAt: at });
      })();
    },

    find(hash: Buffer): StoredKey | null {
      const row = byHash.get(hash) as OwnedRow | undefined;
      if (!row) return null;
      const { userId, hash: stored, banned, banExpires, ...rest } = row;
      return { ...view(rest), userId, hash: stored, banned: banned === 1, banExpires: banExpires ? Date.parse(banExpires) : null };
    },

    touch: (keyId: string, at: number) => touch.run(at, keyId),
  };
}

export type KeyStore = ReturnType<typeof keyStore>;
