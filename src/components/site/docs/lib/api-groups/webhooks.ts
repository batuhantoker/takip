import type { ApiGroup } from '../../api-catalog';

export const WEBHOOKS: ApiGroup = {
  id: 'webhooks',
  title: 'Webhooks',
  blurb: 'Inbound hooks from external services.',
  endpoints: [
    {
      path: '/api/github-webhook',
      method: 'POST',
      summary: 'Receives GitHub repository events and forwards them to a bot.',
      returns: ['success', 'message'],
      env: ['GITHUB_WEBHOOK_SECRET', 'GITHUB_WEBHOOK_FORWARD_URL'],
      requiresAuth: true,
      notes: 'Verifies `X-Hub-Signature-256` and forwards the delivery to `GITHUB_WEBHOOK_FORWARD_URL`. Fails closed: 503 while either variable is unset, 401 on a missing or mismatched signature.',
    },
  ],
};
