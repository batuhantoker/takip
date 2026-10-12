import type { BetterAuthPlugin } from 'better-auth';

/**
 * Keeps an impersonated session's end where the admin plugin put it. Better Auth skips the sliding refresh
 * only while the browser holds `dont_remember`; a client that sends just the session token would otherwise
 * stretch it to the full 30 days. Only get-session's refresh writes `expiresAt`, on the session it just read.
 */
export const impersonationGuard = () =>
  ({
    id: 'impersonation-guard',
    init: () => ({
      options: {
        databaseHooks: {
          session: {
            update: {
              async before(data, ctx) {
                const current = ctx?.context.session?.session as { impersonatedBy?: string | null; expiresAt: Date } | undefined;
                if (data.expiresAt && current?.impersonatedBy) return { data: { ...data, expiresAt: current.expiresAt } };
              },
            },
          },
        },
      },
    }),
  }) satisfies BetterAuthPlugin;
