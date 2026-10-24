/**
 * An event family over time on History's map: the clock runs from the first year to the last and each event
 * shows as it happens, while the globe turns to what each stretch's line talks about (focus in facts.ts). Every
 * number the narrator says (counts, places, the biggest events) is counted from history.db here.
 */
import { basename } from 'node:path';
import { backToStart, isLong, loopBeats, shortHold, shortPace } from '../loop';
import { askJson } from '../narrate/llm';
import { glibIn, STYLE, TODAY } from '../narrate/style';
import type { Beat } from '../scene';
import type { Maker } from './context';
import { countBy, decadeOf, focus, namedIn, sampleYears, spanYears, yearsSaid } from './facts';
import { eventsIn } from './history-db';
import { EVENT_PRESETS, type EventPreset } from './presets/events';

/** Stretches and their length: the short loop (20–25 s), or `--length long`; a short's legs fill its body (loop.ts shortHold). */
const CUTS = { short: { legs: 4, legMs: 4000, words: 11, seconds: 22 }, long: { legs: 5, legMs: 6500, words: 16, seconds: 50 } };
/** Share of a stretch's beat the clock spends running through it; it then holds at the stretch's end. */
const RUN = 0.4;
const FLY_MS = 2500;
const YEAR_S = 365.2425 * 86400;

const yearMs = (y: number) => {
  const d = new Date(0);
  d.setUTCFullYear(y, 0, 1);
  return d.getTime();
};

/** A preset's records: of its kinds and years, inside its box, without what it skips. */
const rowsOf = (p: EventPreset) => eventsIn(p.kinds, p.counted, yearMs(p.from), yearMs(p.to))
  .filter(e => (!p.box || (e.lon >= p.box[0] && e.lat >= p.box[1] && e.lon <= p.box[2] && e.lat <= p.box[3])) && !p.skip?.(e));

/** Words that tell a toll, which no events line says (GUIDELINES § Topics: tragedies stay plain, with no death tolls). */
export const TOLL = /\b(deaths?|died|dies|dying|killed|killing|kills|dead|lives|victims?|casualt\w*|toll|wounded|injur\w*)\b/i;

/** Why a script tells a toll, or null. */
export function tollIn(lines: string[]) {
  const said = lines.map(l => l.match(TOLL)?.[0]).find(Boolean);
  return said ? `no death tolls, tragedies stay plain: a line says "${said}"; tell the event by its physical size` : null;
}

/**
 * Why a line can't be placed in time, or null: "Plesetsk launches 724 rockets" means nothing without its span (takip-98,
 * 2026-10-22). A line with a stretch's count names the stretch ("From 1957 to 1979, …"); any other names its event's year.
 */
export function undatedIn(legs: { from: number; to: number; count: number; where: string[] }[], lines: Record<string, string>) {
  for (const [i, l] of legs.entries()) {
    const key = `leg-${i + 1}`, line = lines[key] ?? '';
    // small numbers are sizes as often as counts ("a 6 out of 8")
    const counts = [l.count, ...l.where.map(w => Number(w.match(/\((\d+)\)$/)?.[1]))].filter(n => n >= 10);
    const numbers = (line.replace(/(\d),(\d{3})/g, '$1$2').match(/(?<![\d.])\d+(?!\d|\.\d)/g) ?? []).map(Number);
    const span = spanYears(line);
    const decade = l.to - l.from === 9 && l.from % 10 === 0 && line.includes(`${l.from}s`);
    if (numbers.some(n => counts.includes(n)) && !decade && !(span.includes(l.from) && (span.includes(l.to) || span.includes(l.to + 1))))
      return `"${key}" tells a count: name its stretch, "From ${l.from} to ${l.to}, …"`;
    if (!yearsSaid(line).some(y => y >= l.from && y <= l.to + 1)) return `"${key}" must name the year of what it tells, from ${l.from} to ${l.to}`;
  }
  return null;
}

const SYSTEM = `You write voiceover for short vertical videos where events appear on a world map as a year counter runs.
Use only the numbers, names and places in the facts; never add causes, blame or numbers of your own. Tragedies stay plain:
never say how many died, were killed or were hurt; tell an event by its physical size (magnitude, explosivity, water height,
wind). ${STYLE}
Reply with JSON only.`;

export const events: Maker = {
  id: 'events',
  kind: 'story',
  presets: Object.keys(EVENT_PRESETS),
  about: `An event family over time, counted from history.db (--preset ${Object.keys(EVENT_PRESETS).join('|')})`,
  async make(ctx) {
    const p = EVENT_PRESETS[ctx.args.preset ?? ''];
    if (!p) throw new Error(`--preset must be one of ${Object.keys(EVENT_PRESETS).join(', ')}`);
    const cut = CUTS[isLong(ctx.args) ? 'long' : 'short'];
    const sampled = sampleYears(p.from, p.to, cut.legs + 1);
    const id = (i: number) => `leg-${i + 1}`;

    const facts = await ctx.once('facts', async () => {
      const all = rowsOf(p);
      const legs = sampled.slice(0, -1).map((y, i) => {
        const rows = all.filter(e => e.t >= yearMs(y) && e.t < yearMs(sampled[i + 1]));
        return {
          from: y,
          to: sampled[i + 1] - 1,
          count: rows.length,
          where: countBy(rows, p.where).slice(0, 3).map(([k, n]) => `${k} (${n})`),
          biggest: [...rows].sort((a, b) => p.size(b) - p.size(a)).filter(e => p.size(e) > 0).slice(0, 3).map(p.describe),
        };
      });
      const [busiest, busiestCount] = countBy(all, e => String(decadeOf(e.t)))[0] ?? ['', 0];
      return { total: all.length, busiest: busiest ? `the ${busiest}s (${busiestCount})` : null, where: countBy(all, p.where).slice(0, 5).map(([k, n]) => `${k} (${n})`), legs };
    });
    if (!facts.total) throw new Error(`no events of ${p.kinds.join(', ')} between ${p.from} and ${p.to}`);
    // the stretches its facts were counted over, which a folder written before the cut's sampling changed still tells
    const years = [...facts.legs.map(l => l.from), facts.legs[facts.legs.length - 1].to + 1];

    const lines = await ctx.once('lines', () => askJson<{ today: string; lines: Record<string, string> }>(SYSTEM,
      `The video shows ${p.topic}. ${p.coverage}${p.tell ? ` ${p.tell}` : ''}\nIn all: ${facts.total} events; most in ${facts.where.join(', ')}; ` +
      `busiest decade ${facts.busiest}.\n\nStretches, in order:\n` +
      facts.legs.map((l, i) => `[${id(i)}] ${l.from}–${l.to}: ${l.count} events; most in ${l.where.join(', ') || 'nowhere'}; ` +
        `biggest: ${l.biggest.join('; ') || 'none recorded'}`).join('\n') +
      `\n\nWrite, every line short (the video is about ${cut.seconds} seconds):\n- ${TODAY};\n` +
      `- "lines": for each stretch, one sentence of at most ${cut.words} words, leading with its most striking fact: a named event with its year ("In 1963, …"), or one count with its stretch ("From 1957 to 1979, Plesetsk launches 724 rockets"), and no test or operation codenames.\n` +
      `Return {"today": "...", "lines": {${facts.legs.map((_, i) => `"${id(i)}": "..."`).join(', ')}}}.`,
      { check: v => !(v.today && facts.legs.every((_, i) => v.lines?.[id(i)]?.trim())) ? 'need "today" and a line for every stretch id'
        : undatedIn(facts.legs, v.lines) ?? tollIn([v.today, ...Object.values(v.lines)]) ?? glibIn([v.today, ...Object.values(v.lines)]) }));
    const { hook, outro } = loopBeats(basename(ctx.dir), lines.today, { variant: ctx.args.variant });

    const camera = await ctx.once('camera', async () => {
      const all = rowsOf(p);
      return facts.legs.map((l, i) => {
        const rows = all.filter(e => e.t >= yearMs(l.from) && e.t < yearMs(years[i + 1]));
        const biggest = [...rows].sort((a, b) => p.size(b) - p.size(a)).filter(e => p.size(e) > 0).slice(0, 3);
        return focus(rows, lines.lines[id(i)], { bounds: [l.from, l.to, years[i + 1]], biggest, place: p.where, size: p.size, describe: p.describe });
      });
    });

    // the value behind each line on screen: the event it names, else the stretch's biggest
    const chips = await ctx.once('chips', async () => {
      const all = rowsOf(p);
      return facts.legs.map((l, i) => {
        const rows = all.filter(e => e.t >= yearMs(l.from) && e.t < yearMs(years[i + 1]));
        const biggest = [...rows].sort((a, b) => p.size(b) - p.size(a)).filter(e => p.size(e) > 0).slice(0, 3);
        const said = namedIn(lines.lines[id(i)], [l.from, l.to, years[i + 1]], biggest, { rows, size: p.size, describe: p.describe });
        const named = said ?? biggest[0];
        // the chip comes up once the clock has run through the stretch; one the line doesn't name says what it is the
        // biggest of, so it doesn't look stale against the year on screen
        const told = named && p.describe(named);
        if (told) return { text: said ? told[0].toUpperCase() + told.slice(1) : `Biggest of ${l.from}–${l.to}: ${told}`, at: RUN };
        // a family with no size (launches, peace deals) shows where most of the stretch happened
        return l.where[0] ? { text: `Most of ${l.from}–${l.to}: ${l.where[0]}`, at: RUN } : null;
      });
    });

    const at = (c: [number, number] | null) => c ?? [20, 0];
    const fly = (c: [number, number] | null) =>
      `__takipMap.flyTo({ center: [${at(c)[1]}, ${at(c)[0]}], zoom: ${p.zoom}, duration: ${FLY_MS}, essential: true })`;
    const legMs = shortPace(ctx.args) ? shortHold(facts.legs.length, CUTS.short.legMs) : cut.legMs;
    const legs: Beat[] = facts.legs.map((l, i) => ({
      id: id(i),
      say: lines.lines[id(i)],
      enter: fly(camera[i]),
      ...(chips[i] ? { chip: chips[i]!.text, chipAt: chips[i]!.at } : {}),
      // runs through the stretch while the line starts, then holds at its end, so the year on screen is never behind
      // the event the line names
      frame: `__takipHistory.clock.seek(${yearMs(l.from)} + ${yearMs(years[i + 1]) - yearMs(l.from)} * Math.min(1, p / ${RUN}))`,
      minMs: legMs,
    }));
    const [lat0, lon0] = at(camera[0]);
    // History keeps an ended event drawn for three seconds of playback at the clock's speed
    const speed = ((p.to - p.from) * YEAR_S) / ((facts.legs.length * legMs * RUN) / 1000);

    return {
      id: `events-${ctx.args.preset}`,
      kind: 'story',
      path: `/?view=history&year=${p.from}&kinds=${p.kinds.join(',')}&lat=${lat0}&lon=${lon0}&zoom=${p.zoom}`,
      chrome: 'map-only',
      ready: 'window.__takipHistory && !__takipHistory.deep()',
      waitOn: '/api/replay/',
      setup: `(() => { const c = __takipHistory.clock; c.pause(); c.setSpeed(${speed}); c.seek(${yearMs(p.from)}); __takipMap.jumpTo({ center: [${lon0}, ${lat0}], zoom: ${p.zoom} }); })()`,
      kicker: p.kicker,
      counter: { expr: 'new Date(__takipHistory.clock.time()).getUTCFullYear()', unit: '{n}', kind: 'year' },
      beats: [
        hook,
        ...legs,
        // back to the first year and the opening view, so the loop's last frame meets its first
        { ...outro, enter: backToStart(`__takipHistory.clock.seek(${yearMs(p.from)})`) },
      ],
      sources: p.sources,
      post: {
        title: p.postTitle,
        description: `${p.postTitle}: ${facts.total.toLocaleString('en')} events on TAKIP's History map. ${p.coverage} Explore it yourself at takip.dev.`,
        hashtags: p.hashtags,
      },
    };
  },
};
