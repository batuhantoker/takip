import type { AppDb } from '../db/app-db';

/** A token Better Auth wouldn't take for its own ciphertext: an envelope, or even-length hex (oauth2/utils `isLikelyEncrypted`). */
const PLAINTEXT = (column: string) =>
  `${column} IS NOT NULL AND ${column} NOT GLOB '$ba$*' AND (length(${column}) % 2 = 1 OR ${column} GLOB '*[^0-9a-fA-F]*')`;

/**
 * Clears provider tokens stored before `account.encryptOAuthTokens` was on, and every ID token, which Better Auth
 * never encrypts. Nothing reads them: sign-in and linking write fresh ones. Runs at each boot, after Better Auth's
 * migrations; encrypted tokens never match, so a second run changes nothing.
 */
export function clearPlaintextOAuthTokens(db: AppDb) {
  const clear = (column: 'accessToken' | 'refreshToken') =>
    db.prepare(`UPDATE auth_account SET ${column} = NULL WHERE ${PLAINTEXT(column)}`).run().changes;
  return db.transaction(() => ({
    accessToken: clear('accessToken'),
    refreshToken: clear('refreshToken'),
    idToken: db.prepare('UPDATE auth_account SET idToken = NULL WHERE idToken IS NOT NULL').run().changes,
  }))();
}

/** Keeps a provider's ID token out of auth_account: it carries the user's profile, and nothing of ours reads it. */
export async function withoutIdToken(account: { idToken?: string | null }) {
  if (account.idToken) return { data: { idToken: null } };
}
