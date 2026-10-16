/** Why a route that can run on the server's model key didn't: the caller's plan, or the plan check failing. */
export type HostedAiBlock = 'entitlement_required' | 'access_unavailable';

/** What to tell the visitor for a hosted-AI refusal, from an error body's `error` or overview's `hostedAi`; null for anything else. */
export function hostedAiNotice(code: unknown): string | null {
  if (code === 'entitlement_required') return 'Hosted AI is part of Pro. Add your own key in TI to use it free.';
  if (code === 'access_unavailable') return 'Couldn’t check your plan just now, so hosted AI is off. Try again in a moment.';
  return null;
}
