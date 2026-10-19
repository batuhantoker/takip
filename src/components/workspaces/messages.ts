import type { WorkspaceFailure } from '@/lib/platform/workspaces/api';
import { MAX_STATE_BYTES } from '@/lib/platform/workspaces/state';
import { msg, type Translate } from '@/lib/core/i18n/translator';

export const SIGN_IN_TO_SAVE = msg('Sign in to save this view as a workspace and open it on any device.');

export function describeWorkspaceFailure({ error, limit }: WorkspaceFailure, t: Translate): string {
  switch (error) {
    case 'limit_reached':
      return t('Your plan allows {n, plural, one {# workspace} other {# workspaces}}. Delete one to save another.', { n: limit ?? 0 });
    case 'entitlement_required':
      return t("Your plan doesn't include share links.");
    case 'too_large':
      return t('This view is over {size} KB, too big to save. Remove some drawn areas and try again.', { size: MAX_STATE_BYTES / 1024 });
    case 'invalid_request':
      return t('Give it a name of up to {n} characters.', { n: 80 });
    case 'not_found':
      return t('That workspace was deleted, perhaps on another device.');
    case 'sign_in_required':
      return t('You were signed out. Sign in again to save.');
    case 'unsupported_state':
      return t('That workspace was saved by a newer version. Reload the page to open it.');
    case 'network':
      return t("Couldn't reach the server. Check your connection and try again.");
    default:
      return t('Something went wrong. Try again.');
  }
}
