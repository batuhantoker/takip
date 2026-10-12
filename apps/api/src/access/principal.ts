import type { Subject } from './resolver';

/** Who is calling (backend.md §5.1). `ip` is the resolved client address (client-ip.ts); `scopes` empty or absent: unrestricted (keys/scopes.ts). */
export type Principal =
  | { kind: 'anon'; ip: string }
  | { kind: 'user'; userId: string; ip: string }
  | { kind: 'key'; keyId: string; userId: string; ip: string; scopes?: readonly string[] };

/** The account whose plan and quota apply; a key counts against its owner. */
export function subjectOf(principal: Principal): Subject | null {
  return principal.kind === 'anon' ? null : { type: 'user', id: principal.userId };
}
