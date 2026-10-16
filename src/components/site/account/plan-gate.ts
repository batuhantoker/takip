import type { BoolEntitlement } from '@takip/core/entitlements';
import { showAccountDialog } from './account-dialog-state';
import { authClient } from './auth-client';
import { useAccess } from './use-access';

/** For something the caller's plan leaves out: a visitor is asked to make a free account, a signed-in person shown their plan. */
export function askForAccount(reason: { visitor: string; member: string }, signedIn: boolean) {
  showAccountDialog(signedIn ? { kind: 'settings', tab: 'account', notice: reason.member } : { kind: 'sign-up', notice: reason.visitor });
}

export const useSignedIn = () => authClient.useSession().data != null;

/** Whether the caller's plan includes `key`; null until the plan is known, so nothing locks while the api is unreachable. */
export function useEntitlement(key: BoolEntitlement): boolean | null {
  const access = useAccess();
  return access ? access.entitlements[key] : null;
}
