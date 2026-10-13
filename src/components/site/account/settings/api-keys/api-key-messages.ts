import type { ApiKeyFailure } from '@/lib/account/api-keys';
import { FALLBACK_ERROR } from '@/components/site/account/use-form-action';

export const keyCount = (n: number) => (n === 1 ? '1 key' : `${n} keys`);

export function describeKeyFailure({ error, limit }: ApiKeyFailure): string {
  switch (error) {
    case 'entitlement_required':
      return "Your plan doesn't include API access.";
    case 'limit_reached':
      return `Your plan allows ${keyCount(limit ?? 0)}. Revoke one to create another.`;
    case 'invalid_request':
      return 'Give the key a name of up to 64 characters.';
    case 'not_found':
      return 'That key was already revoked.';
    case 'sign_in_required':
      return 'You were signed out. Sign in again to manage your keys.';
    default:
      return FALLBACK_ERROR;
  }
}
