import type { ReportView } from './report-view';

/** Mirrors apps/api/src/reports/schemas.ts. */
export const MIN_MESSAGE = 10;
export const MAX_MESSAGE = 2000;

export type SendFailure = { error: 'rate_limited'; retryAfterS: number } | { error: 'invalid' | 'failed' | 'network' };

/** Sends a report to the api (apps/api/src/reports/routes.ts) through this origin's /api/v1 proxy. Null means it arrived. */
export async function sendReport(report: { message: string; view: ReportView }, send: typeof fetch = fetch): Promise<SendFailure | null> {
  let res: Response;
  try {
    res = await send('/api/v1/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report), cache: 'no-store' });
  } catch {
    return { error: 'network' };
  }
  if (res.ok) return null;
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
    return { error: 'rate_limited', retryAfterS: Number(body.retry_after) || 600 };
  }
  return { error: res.status === 400 || res.status === 413 ? 'invalid' : 'failed' };
}
