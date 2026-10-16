import { describe, expect, it, vi } from 'vitest';
import { CELESTRAK_GROUPS, downloadDue, dueGroups, emptySchedule, PAUSE_MS, UPDATE_MS, USER_AGENT } from './celestrak';

const ISS = 'ISS (ZARYA)\n1 25544U 98067A   24146.40251785  .00015505  00000-0  27885-3 0  9997\n2 25544  51.6402 189.7042 0004381 334.8091 106.8778 15.50091157455243\n';
const T = Date.parse('2026-10-12T12:00:00Z');
const [ACTIVE, VISUAL, FENGYUN, IRIDIUM, COSMOS] = CELESTRAK_GROUPS;

const replies = (byUrl: Record<string, Response>) =>
  vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async url => byUrl[String(url)] ?? new Response(ISS, { status: 200 }));

describe('CelesTrak downloads', () => {
  it('asks for each group once per two-hour update, with an honest user agent', async () => {
    const schedule = emptySchedule();
    const get = replies({});
    const first = await downloadDue(schedule, { fetch: get as typeof fetch, now: () => T, log: () => {} });
    expect(first.size).toBe(CELESTRAK_GROUPS.length);
    expect(get.mock.calls[0][1]?.headers).toEqual({ 'User-Agent': USER_AGENT });
    expect(dueGroups(schedule, T + UPDATE_MS - 1)).toEqual([]);
    expect(dueGroups(schedule, T + UPDATE_MS)).toEqual(CELESTRAK_GROUPS);
    await downloadDue(schedule, { fetch: get as typeof fetch, now: () => T + 60_000, log: () => {} });
    expect(get).toHaveBeenCalledTimes(CELESTRAK_GROUPS.length);
  });

  it('keeps what it has on "not updated", retires a 404, and stops everything at an unexplained refusal', async () => {
    const schedule = emptySchedule();
    const logs: string[] = [];
    const get = replies({
      [VISUAL]: new Response('GP data has not updated since your last successful download of GROUP=visual', { status: 403 }),
      [FENGYUN]: new Response('Not found', { status: 404 }),
      [IRIDIUM]: new Response('Too many requests', { status: 429 }),
    });
    const fresh = await downloadDue(schedule, { fetch: get as typeof fetch, now: () => T, log: m => logs.push(m) });
    expect([...fresh.keys()]).toEqual([ACTIVE]);
    expect(schedule.gone).toEqual([FENGYUN]);
    expect(schedule.pausedUntil).toBe(T + PAUSE_MS);
    // Nothing after the refusal was asked for.
    expect(get.mock.calls.map(([url]) => String(url))).not.toContain(COSMOS);
    expect(logs).toHaveLength(2);

    // Paused: nothing is due even once the update window has passed, and the retired group never is.
    expect(dueGroups(schedule, T + UPDATE_MS)).toEqual([]);
    expect(dueGroups(schedule, T + PAUSE_MS)).not.toContain(FENGYUN);
  });

  it('stops at a network failure without pausing', async () => {
    const schedule = emptySchedule();
    const get = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    expect((await downloadDue(schedule, { fetch: get as typeof fetch, now: () => T, log: () => {} })).size).toBe(0);
    expect(get).toHaveBeenCalledTimes(1);
    expect(schedule.pausedUntil).toBe(0);
    expect(dueGroups(schedule, T)).toEqual(CELESTRAK_GROUPS.slice(1));
  });
});
