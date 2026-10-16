import type { WorkspaceFailure } from '@/lib/platform/workspaces/api';
import { MAX_STATE_BYTES } from '@/lib/platform/workspaces/state';

const FALLBACK = 'Something went wrong. Try again.';

export const SIGN_IN_TO_SAVE = 'Sign in to save this view as a workspace and open it on any device.';

export const workspaceCount = (n: number) => (n === 1 ? '1 workspace' : `${n} workspaces`);

export function describeWorkspaceFailure({ error, limit }: WorkspaceFailure): string {
  switch (error) {
    case 'limit_reached':
      return `Your plan allows ${workspaceCount(limit ?? 0)}. Delete one to save another.`;
    case 'entitlement_required':
      return "Your plan doesn't include share links.";
    case 'too_large':
      return `This view is over ${MAX_STATE_BYTES / 1024} KB, too big to save. Remove some drawn areas and try again.`;
    case 'invalid_request':
      return 'Give it a name of up to 80 characters.';
    case 'not_found':
      return 'That workspace was deleted, perhaps on another device.';
    case 'sign_in_required':
      return 'You were signed out. Sign in again to save.';
    case 'unsupported_state':
      return 'That workspace was saved by a newer version. Reload the page to open it.';
    case 'network':
      return "Couldn't reach the server. Check your connection and try again.";
    default:
      return FALLBACK;
  }
}
