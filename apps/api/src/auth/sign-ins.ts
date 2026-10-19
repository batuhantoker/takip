import type { AppDb } from '../db/app-db';

type NewSession = { userId: string; ipAddress?: string | null; userAgent?: string | null; impersonatedBy?: string | null };

/** Records each new session in sign_in: Better Auth deletes a session's row on sign-out, so auth_session alone loses them. */
export function signInLog(db: AppDb, now = () => Date.now()) {
  const insert = db.prepare('INSERT INTO sign_in (user_id, at, ip_address, user_agent, impersonated_by) VALUES (?, ?, ?, ?, ?)');
  return (session: NewSession) => {
    insert.run(session.userId, now(), session.ipAddress ?? null, session.userAgent?.slice(0, 400) || null, session.impersonatedBy ?? null);
  };
}
