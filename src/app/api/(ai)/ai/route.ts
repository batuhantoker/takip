import { describe, disabled, disabledResponse, json, siteOrigin } from '@/lib/ai/service';

/**
 * TAKIP AI — what the service offers: providers, depths, limits, endpoints.
 * GET /api/ai
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (disabled()) return disabledResponse();
  return json(describe(siteOrigin(req)));
}
