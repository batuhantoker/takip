import { describe, expect, it, vi } from 'vitest';
import { sendReport } from './reports-api';

const REPORT = { message: 'The ferry is drawn on land.', view: { mode: 'live' as const, link: '/?lat=1.0000&lon=2.0000' } };
const answer = (status: number, body: unknown = {}) => vi.fn(async () => Response.json(body, { status })) as unknown as typeof fetch;

describe('sendReport', () => {
  it('posts the message and view to the api', async () => {
    const send = answer(201, { ok: true, id: 1 });
    expect(await sendReport(REPORT, send)).toBeNull();
    expect(send).toHaveBeenCalledWith('/api/v1/reports', expect.objectContaining({ method: 'POST', body: JSON.stringify(REPORT) }));
  });

  it('tells a rate limit, a refusal, a failure and no connection apart', async () => {
    expect(await sendReport(REPORT, answer(429, { error: 'rate_limited', retry_after: 120 }))).toEqual({ error: 'rate_limited', retryAfterS: 120 });
    expect(await sendReport(REPORT, answer(400, { error: 'invalid_request' }))).toEqual({ error: 'invalid' });
    expect(await sendReport(REPORT, answer(502))).toEqual({ error: 'failed' });
    expect(await sendReport(REPORT, vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch)).toEqual({ error: 'network' });
  });
});
