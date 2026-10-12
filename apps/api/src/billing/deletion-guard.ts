import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import type { AppDb } from '../db/app-db';
import { paidSubscriptionCheck } from './paid-subscription';

export const SUBSCRIPTION_ACTIVE = 'subscription_active';
const CANCEL_FIRST = 'Your subscription is still active. Cancel it before deleting your account.';

/**
 * Refuses account deletion while the user pays a provider, so no subscription outlives its account. `plugin`
 * answers the request before any email goes out; `assertDeletable` is the check again when the link is opened.
 * `billingPortal` tells the client whether POST /api/billing/portal can help.
 */
export function deletionGuard(db: AppDb, { billingPortal }: { billingPortal: boolean }) {
  const hasPaidSubscription = paidSubscriptionCheck(db);

  const assertDeletable = (userId: string) => {
    if (hasPaidSubscription(userId)) {
      throw new APIError('CONFLICT', { code: SUBSCRIPTION_ACTIVE, message: CANCEL_FIRST, billing_portal: billingPortal });
    }
  };

  const plugin = {
    id: 'deletion-guard',
    hooks: {
      before: [
        {
          matcher: ctx => ctx.path === '/delete-user',
          // Before hooks run ahead of the endpoint's own session middleware, so the session is read here.
          handler: createAuthMiddleware(async ctx => {
            const session = await getSessionFromCtx(ctx, { disableRefresh: true });
            if (session) assertDeletable(session.user.id);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;

  return { plugin, assertDeletable };
}
