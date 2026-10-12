import type { AppDb } from '../db/app-db';
import { ulid } from './ids';
import { STATE_VERSION, type WorkspaceState } from './state';

/** A workspace as its owner sees it in a list. Times are epoch ms. */
export type WorkspaceSummary = {
  id: string;
  name: string;
  rev: number;
  visibility: 'private' | 'link' | 'public';
  shareSlug: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Workspace = WorkspaceSummary & { state: WorkspaceState; stateVersion: number };

export type SharedWorkspace = { name: string; state: WorkspaceState; stateVersion: number; updatedAt: number };

/** `*` overwrites whatever is stored (autosave); a rev must match the stored one. */
export type IfMatch = number | '*';

export type UpdateResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'stale_rev'; rev: number };

const SUMMARY = `workspace_id AS id, name, rev, visibility, share_slug AS shareSlug, created_at AS createdAt, updated_at AS updatedAt`;
const LIVE = 'workspace_id = @id AND owner_id = @ownerId AND deleted_at IS NULL';

type Row = WorkspaceSummary & { state: string; stateVersion: number };

const full = ({ state, ...row }: Row): Workspace => ({ ...row, state: JSON.parse(state) as WorkspaceState });

/** The ws_workspace table. Every lookup by id is scoped to its owner and skips deleted rows. */
export function workspaceStore(db: AppDb) {
  const list = db.prepare(`SELECT ${SUMMARY} FROM ws_workspace WHERE owner_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC, workspace_id`);
  const one = db.prepare(`SELECT ${SUMMARY}, state, state_version AS stateVersion FROM ws_workspace WHERE ${LIVE}`);
  const live = db.prepare('SELECT count(*) FROM ws_workspace WHERE owner_id = ? AND deleted_at IS NULL').pluck();
  const insert = db.prepare(`
    INSERT INTO ws_workspace (workspace_id, owner_id, name, state, state_version, created_at, updated_at)
    VALUES (@id, @ownerId, @name, @state, @stateVersion, @at, @at)`);
  const update = db.prepare(`
    UPDATE ws_workspace SET name = coalesce(@name, name), state = coalesce(@state, state), state_version = @stateVersion,
      rev = rev + 1, updated_at = @at
    WHERE ${LIVE}`);
  const remove = db.prepare(`UPDATE ws_workspace SET deleted_at = @at, share_slug = NULL, visibility = 'private' WHERE ${LIVE}`);
  const setSlug = db.prepare(`UPDATE ws_workspace SET share_slug = @slug, visibility = CASE WHEN @slug IS NULL THEN 'private' ELSE 'link' END WHERE ${LIVE}`);
  const bySlug = db.prepare(`
    SELECT name, state, state_version AS stateVersion, updated_at AS updatedAt FROM ws_workspace
    WHERE share_slug = ? AND deleted_at IS NULL`);

  const get = (ownerId: string, id: string) => {
    const row = one.get({ id, ownerId }) as Row | undefined;
    return row ? full(row) : null;
  };

  return {
    list: (ownerId: string) => list.all(ownerId) as WorkspaceSummary[],

    get,

    /** Null when the owner already has `max` workspaces. */
    create(p: { ownerId: string; name: string; state: WorkspaceState; max: number; at: number }) {
      return db.transaction(() => {
        if ((live.get(p.ownerId) as number) >= p.max) return null;
        const id = ulid(p.at);
        insert.run({ id, ownerId: p.ownerId, name: p.name, state: JSON.stringify(p.state), stateVersion: STATE_VERSION, at: p.at });
        return get(p.ownerId, id)!;
      })();
    },

    update(p: { ownerId: string; id: string; ifMatch: IfMatch; name?: string; state?: WorkspaceState; at: number }): UpdateResult {
      return db.transaction((): UpdateResult => {
        const current = get(p.ownerId, p.id);
        if (!current) return { ok: false, error: 'not_found' };
        if (p.ifMatch !== '*' && p.ifMatch !== current.rev) return { ok: false, error: 'stale_rev', rev: current.rev };
        update.run({
          id: p.id, ownerId: p.ownerId, at: p.at, name: p.name ?? null,
          state: p.state ? JSON.stringify(p.state) : null, stateVersion: p.state ? STATE_VERSION : current.stateVersion,
        });
        return { ok: true, workspace: get(p.ownerId, p.id)! };
      })();
    },

    /** Soft delete; a share link dies with it. */
    remove: (ownerId: string, id: string, at: number) => remove.run({ id, ownerId, at }).changes > 0,

    /** A new slug replaces the old one, so the old link stops working; null revokes. */
    setSlug: (ownerId: string, id: string, slug: string | null) => setSlug.run({ id, ownerId, slug }).changes > 0,

    shared(slug: string): SharedWorkspace | null {
      const row = bySlug.get(slug) as (Omit<SharedWorkspace, 'state'> & { state: string }) | undefined;
      return row ? { ...row, state: JSON.parse(row.state) as WorkspaceState } : null;
    },
  };
}

export type WorkspaceStore = ReturnType<typeof workspaceStore>;
