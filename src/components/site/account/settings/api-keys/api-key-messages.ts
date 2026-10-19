import type { ApiKeyFailure } from '@/lib/platform/account/api-keys';
import type { Translate } from '@/lib/core/i18n/translator';
import { FALLBACK_ERROR } from '@/components/site/account/use-form-action';

export const keyLimit = (limit: number, t: Translate) =>
  t('Your plan allows {n, plural, one {# key} other {# keys}}. Revoke one to create another.', { n: limit });

export function describeKeyFailure({ error, limit }: ApiKeyFailure, t: Translate): string {
  switch (error) {
    case 'entitlement_required':
      return t("Your plan doesn't include API access.");
    case 'limit_reached':
      return keyLimit(limit ?? 0, t);
    case 'invalid_request':
      return t('Give the key a name of up to 64 characters.');
    case 'not_found':
      return t('That key was already revoked.');
    case 'sign_in_required':
      return t('You were signed out. Sign in again to manage your keys.');
    default:
      return t(FALLBACK_ERROR);
  }
}
