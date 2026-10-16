import { describe, expect, it } from 'vitest';
import type { Lookup } from '../tools';
import { chronicle, pastEvent, pickSignificant, spanOf, spanWords, windowOf } from './history';

const year = (y: number) => {
  const d = new Date(0);
  d.setUTCFullYear(y, 0, 1);
  return d.getTime() / 1000;
};

const event = (id: number, family: string, title: string, y0: number, y1: number, magnitude: number | null, kind = 'war.interstate') => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [20, 44] },
  properties: { id, kind, family, title, t0: year(y0), t1: year(y1 + 1), prec: 4, ongoing: 0, geoPrec: 2, magnitude, sourceId: 1 },
});
const cell = (family: string, n: number) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [20, 44] },
  properties: { cell: 1, family, t0: year(1990), t1: year(2000), n, magnitude: null },
});

function lookup(get: (path: string) => unknown) {
  const gets: string[] = [];
  const lk: Lookup = {
    data: () => ({}),
    geocode: async q => (/balkans/i.test(q) ? { name: 'Balkans', lat: 44, lng: 20, kind: 'region' } : null),
    get: async path => {
      gets.push(path);
      const v = get(path);
      if (v instanceof Error) throw v;
      return v;
    },
  };
  return { lk, gets };
}

describe('spanOf / windowOf', () => {
  it('reads years, BCE years, decades, months and dates', () => {
    expect(spanOf('1914')).toEqual([year(1914), year(1915)]);
    expect(spanOf(1914)).toEqual([year(1914), year(1915)]);
    expect(spanOf('500 BC')).toEqual([year(-499), year(-498)]);
    expect(spanOf('-500')).toEqual([year(-500), year(-499)]);
    expect(spanOf('the 1990s')).toEqual([year(1990), year(2000)]);
    expect(spanOf('May 1945')).toEqual([Date.UTC(1945, 4, 1) / 1000, Date.UTC(1945, 5, 1) / 1000]);
    expect(spanOf('1945-05-08')).toEqual([Date.UTC(1945, 4, 8) / 1000, Date.UTC(1945, 4, 9) / 1000]);
    expect(spanOf('soon')).toBeNull();
  });

  it('makes to inclusive, defaults it to the end of from, and refuses a backwards window', () => {
    expect(windowOf('1990', '2000')).toEqual({ from: year(1990), to: year(2001) });
    expect(windowOf('1990', undefined)).toEqual({ from: year(1990), to: year(1991) });
    expect(windowOf('2000', '1990')).toBe('to comes before from');
    expect(typeof windowOf('whenever', undefined)).toBe('string');
  });
});

describe('pickSignificant', () => {
  const e = (id: number, family: string, magnitude: number | null, kind = 'war', y0 = 1990, y1 = 1991) => ({ id, family, kind, magnitude, t0: year(y0), t1: year(y1) });

  it('lets the wars lead without crowding out the other families', () => {
    const picked = pickSignificant([
      e(1, 'conflict', 100), e(2, 'conflict', 50), e(3, 'conflict', 20), e(4, 'conflict', 10),
      e(5, 'politics', null, 'politics.treaty'), e(6, 'politics', null, 'politics.treaty', 1990, 1995),
      e(7, 'disaster', 30, 'disaster.flood'),
    ], 5);
    // conflict scores 6, 3, 2, 1.5; politics 3, 1.5; disaster 1: the longer treaty breaks the null-size tie.
    expect(picked.map(x => x.id)).toEqual([1, 2, 6, 3, 4]);
    expect(pickSignificant([e(1, 'conflict', 100), e(7, 'disaster', 30, 'disaster.flood')], 5).map(x => x.id)).toEqual([1, 7]);
  });

  it('puts unsized events that only carry on from before the window behind what happened in it', () => {
    const claim = (id: number, y0: number) => ({ ...e(id, 'territorial', null, 'claim.territorial', y0, 2030) });
    // Longest-first would lead with the 1828 claim; a period's story starts with what began in it.
    const picked = pickSignificant([claim(1, 1828), claim(2, 1964), claim(3, 1992), claim(4, 1995)], 4, year(1990));
    expect(picked.map(x => x.id)).toEqual([3, 4, 2, 1]);
    // A sized war that began before the window still competes on its size.
    expect(pickSignificant([e(5, 'conflict', 50_000, 'war', 1985, 1995), e(6, 'conflict', 100, 'war', 1993, 1994)], 1, year(1990)).map(x => x.id)).toEqual([5]);
  });

  it('counts a battle or armed-conflict pair at a quarter of its toll, as part of a war', () => {
    const picked = pickSignificant([e(1, 'conflict', 3000, 'battle'), e(2, 'conflict', 1000, 'war.civil'), e(3, 'conflict', 500, 'conflict.genocide')], 3);
    expect(picked.map(x => x.id)).toEqual([2, 1, 3]);
  });
});

describe('spanWords', () => {
  it('writes one date, a range, or since', () => {
    expect(spanWords({ t0: year(1916), t1: year(1917), prec: 4, ongoing: 0 })).toBe('1916');
    expect(spanWords({ t0: year(1991), t1: year(1996), prec: 4, ongoing: 0 })).toBe('1991 – 1995');
    expect(spanWords({ t0: year(2011), t1: year(2027), prec: 4, ongoing: 1 })).toBe('since 2011');
  });
});

describe('chronicle', () => {
  const reply = {
    counts: { conflict: 2, politics: 1, terror: 3400 },
    features: [
      event(11, 'conflict', 'Bosnian War', 1992, 1995, 100_000),
      event(10, 'conflict', 'Croatian War of Independence', 1991, 1995, 20_000, 'war.independence'),
      event(12, 'politics', 'Dayton Agreement', 1995, 1995, null, 'politics.treaty'),
      cell('terror', 3400),
    ],
  };

  it('asks the route for the place and period, and every family when none is given', async () => {
    const { lk, gets } = lookup(() => reply);
    await chronicle({ place: 'Balkans', from: '1990', to: '2000' }, lk);
    expect(gets[0]).toMatch(/^\/api\/replay\/history\/events\?bbox=/);
    expect(gets[0]).toContain(`from=${year(1990)}&to=${year(2001)}`);
    expect(gets[0]).not.toContain('families=');
  });

  it('filters by family, worldwide without a place, and refuses an unknown family', async () => {
    const { lk, gets } = lookup(() => reply);
    await chronicle({ from: '1990s', families: ['conflict', 'politics'] }, lk);
    expect(gets[0]).toContain('bbox=-180,-90,180,90');
    expect(gets[0]).toContain('&families=conflict,politics');
    const bad = await chronicle({ from: '1990', families: ['wars'] }, lk);
    expect(bad.result.ok).toBe(false);
    expect(bad.result.summary).toMatch(/No such family/);
  });

  it('lists the story oldest first, says what was too dense, and marks it', async () => {
    const { lk } = lookup(() => reply);
    const out = await chronicle({ place: 'Balkans', from: '1990', to: '2000' }, lk);
    expect(out.result.ok).toBe(true);
    const data = out.result.data as { events: { id: number; when: string; what: string; size?: string }[]; too_dense_to_list?: string[]; total: number };
    expect(data.events.map(x => x.id)).toEqual([10, 11, 12]);
    expect(data.events[0]).toMatchObject({ when: '1991 – 1995', what: 'War of independence', size: 'Deaths: 20,000' });
    expect(data.too_dense_to_list).toEqual(['terror']);
    expect(data.total).toBe(3403);
    expect(out.result.summary).toMatch(/terror too dense to list/);
    expect(out.card?.kind).toBe('history');
    expect(out.effects?.highlight?.points).toHaveLength(3);
    expect(out.effects?.fly).toBeDefined();
  });

  it('trims the least significant to fit the prompt, not the most recent', async () => {
    // The latest events are the biggest, so trimming the tail of a time-sorted list would lose them.
    const features = Array.from({ length: 25 }, (_, i) => event(100 + i, 'conflict', `${'War '.repeat(17)}${i}`.slice(0, 70), 1900 + i, 1900 + i, 1000 + i));
    const { lk } = lookup(() => ({ counts: { conflict: 25 }, features }));
    const out = await chronicle({ from: '1900', to: '1924', limit: 25 }, lk);
    const data = out.result.data as { events: { id: number }[] };
    expect(JSON.stringify(data).length).toBeLessThanOrEqual(3300);
    expect(data.events.length).toBeLessThan(25);
    const kept = data.events.map(x => x.id);
    expect(kept).toContain(124);
    expect(Math.min(...kept)).toBeGreaterThan(100);
    expect(kept).toEqual([...kept].sort((x, y) => x - y));
  });

  it('says plainly when the record is empty, missing, or not loaded', async () => {
    const empty = await chronicle({ place: 'Balkans', from: '1200' }, lookup(() => ({ counts: {}, features: [] })).lk);
    expect(empty.result.ok).toBe(true);
    expect(empty.result.summary).toMatch(/No events/);
    const down = await chronicle({ from: '1990' }, lookup(() => new Error('HTTP 503')).lk);
    expect(down.result.summary).toMatch(/not loaded/);
    const nowhere = await chronicle({ place: 'Atlantis', from: '1990' }, lookup(() => reply).lk);
    expect(nowhere.result.summary).toMatch(/Could not find/);
    const when = await chronicle({ from: 'whenever' }, lookup(() => reply).lk);
    expect(when.result.ok).toBe(false);
  });
});

describe('pastEvent', () => {
  const vukovar = {
    id: 7, kind: 'battle', family: 'conflict', title: 'Battle of Vukovar', t0: Date.UTC(1991, 7, 25) / 1000, t1: Date.UTC(1991, 10, 19) / 1000,
    tStart: Date.UTC(1991, 7, 25) / 1000, tEnd: Date.UTC(1991, 10, 18) / 1000, prec: 6, endPrec: 6, ongoing: 0, geoPrec: 2, magnitude: 3000,
    lat: 45.35, lon: 19.0,
    attrs: { wiki: 'Battle of Vukovar', belligerents: { left: ['Croatia'], right: ['Yugoslavia'] } },
    relations: [{ rel: 'part_of', otherId: 3, direction: 'out', confidence: 1 }],
    source: { code: 'ucdp', name: 'UCDP', attribution: 'UCDP GED' },
  };
  const war = { ...vukovar, id: 3, kind: 'war.independence', title: 'Croatian War of Independence', tStart: year(1991), tEnd: year(1995), prec: 4, endPrec: 4, attrs: {}, relations: [] };
  const get = (path: string) => (path.endsWith('/7') ? vukovar : path.endsWith('/3') ? war : null);

  it('tells one event in depth, with the war it was part of', async () => {
    const out = await pastEvent({ id: 7 }, lookup(get).lk);
    expect(out.result.ok).toBe(true);
    const data = out.result.data as Record<string, unknown>;
    expect(data).toMatchObject({
      title: 'Battle of Vukovar', what: 'Battle', when: '25 Aug 1991 – 18 Nov 1991', size: 'Deaths: 3,000',
      facts: { Belligerents: 'Croatia vs Yugoslavia' },
      wikipedia: 'https://en.wikipedia.org/wiki/Battle_of_Vukovar',
      source: 'UCDP · UCDP GED', placed_at: 'the city',
    });
    expect((data.part_of as { title: string }[])[0].title).toBe('Croatian War of Independence');
    expect(out.result.summary).toMatch(/part of Croatian War of Independence/);
    expect(out.card?.kind).toBe('history');
    expect(out.effects?.fly?.zoom).toBe(7);
  });

  it('refuses a bad id and says when there is no such event', async () => {
    expect((await pastEvent({ id: 'abc' }, lookup(get).lk)).result.ok).toBe(false);
    const missing = await pastEvent({ id: 99 }, lookup(get).lk);
    expect(missing.result.summary).toMatch(/No event 99/);
  });
});
