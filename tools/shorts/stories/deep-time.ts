/**
 * Earth's plates through deep time, told by History's own documentary: each beat opens a chapter, and the app
 * runs its clock and camera there exactly as it does for a reader. The words come from the chapters' text.
 */
import { CHAPTERS, legMs } from '../../../src/lib/history/paleo/story';
import { backToStart, isLong, lengthProblem, saidAs, loopBeats, shortHold, shortPace, wordsFor } from '../loop';
import { askJson } from '../narrate/llm';
import { glibIn, STYLE } from '../narrate/style';
import type { Beat } from '../scene';
import type { Maker } from './context';

/** The chapters told by default, by age in millions of years: Pangaea's end to today, under a minute. */
const DEFAULT_CHAPTERS = { short: [252, 66, 0], long: [252, 201, 66, 50, 0] };
/** A short tells at most this many chapters, on quicker runs, its holds filling 20–25 s (loop.ts shortHold). */
const SHORT_CHAPTERS = 3;
const SHORT_LEG_MS = 3000;
const SETTLE_MS = { short: 600, long: 1200 };
const ZOOM_IN = 0.5;

const SYSTEM = `You write voiceover for short vertical videos about Earth's history.
Use only the facts you are given. One or two sentences per line, present tense. ${STYLE}
Reply with JSON only.`;

export const deepTime: Maker = {
  id: 'deep-time',
  kind: 'story',
  about: 'Continents drifting through deep time, chapter by chapter (--chapters 252,201,66,50,0)',
  async make(ctx) {
    const long = isLong(ctx.args);
    const asked = ctx.args.chapters?.split(',').map(Number) ?? DEFAULT_CHAPTERS[long ? 'long' : 'short'];
    // a short over a longer list keeps its first three topic chapters; Today is every list's same closer
    const wanted = long || asked.length <= SHORT_CHAPTERS ? asked : asked.filter(ma => ma > 0).slice(0, SHORT_CHAPTERS);
    const told = CHAPTERS.map((ch, i) => ({ ch, i })).filter(({ ch }) => wanted.includes(ch.ma));
    if (!told.length) throw new Error(`no chapters at ${wanted.join(', ')} Ma; there are ${CHAPTERS.map(c => c.ma).join(', ')}`);
    const startMa = Math.min(1800, Math.ceil((told[0].ch.ma + 20) / 50) * 50);
    const id = (ma: number) => `ma-${ma}`;

    const short = shortPace(ctx.args);
    const words = short ? wordsFor(shortHold(told.length, 0)) : { lo: 12, hi: 16 };
    const lines = await ctx.once('lines', () => askJson<{ lines: Record<string, string> }>(SYSTEM,
      `The video covers ${startMa} million years of Earth in a few seconds. Write (the video is about ${long ? 50 : 22} seconds):\n` +
      `- one narration line of ${saidAs(words)} for each chapter below, telling only that chapter, from its facts alone.\n\n` +
      told.map(({ ch }) => `[${id(ch.ma)}] ${ch.title}, ${ch.ma} million years ago: ${ch.body}`).join('\n') +
      `\n\nReturn {"lines": {${told.map(({ ch }) => `"${id(ch.ma)}": "..."`).join(', ')}}}.`,
      { check: v => (told.every(({ ch }) => v.lines?.[id(ch.ma)]?.trim()) ? glibIn(Object.values(v.lines)) ?? lengthProblem(v.lines, words) : 'need a line for every chapter id') }));
    const { hook, outro } = await loopBeats(ctx, { topic: `${startMa} million years of drifting continents`, lines: told.map(({ ch }) => lines.lines[id(ch.ma)]),
      facts: told.map(({ ch }) => `${ch.title}, ${ch.ma} million years ago`).join('; ') });

    const leg = (from: number, to: number) => (short ? Math.min(legMs(from, to), SHORT_LEG_MS) : legMs(from, to));
    const go = (i: number, ms: number) => `__takipHistory.story.go(${i}, ${ms})`;
    let ma = startMa;
    const chapters: Beat[] = told.map(({ ch, i }, n) => {
      // the hook already set off for the first chapter
      // the title waits for the clock to reach its chapter, or it labels the age the leg set off from
      const ms = leg(ma, ch.ma);
      const hold = short ? shortHold(told.length, 0) : 0;
      const beat: Beat = { id: id(ch.ma), say: lines.lines[id(ch.ma)], title: ch.title, ...(n ? { enter: go(i, ms), minMs: Math.max(hold, ms + SETTLE_MS[short ? 'short' : 'long']), titleAt: { ms } } : { minMs: hold }) };
      ma = ch.ma;
      return beat;
    });

    return {
      id: 'deep-time',
      kind: 'story',
      path: `/?view=deep&ma=${startMa}`,
      chrome: 'map-only',
      waitOn: '/api/replay/|/data/paleo/',
      ready: `window.__takipHistory && __takipHistory.deep()`,
      // the chapters' zooms are framed for a wide window; a tall frame has room for a bigger globe
      setup: `(() => { __takipHistory.deepClock.pause(); const m = __takipMap, fly = m.flyTo.bind(m); m.flyTo = (o, e) => fly(o.raw ? o : { ...o, zoom: (o.zoom ?? m.getZoom()) + ${ZOOM_IN} }, e); })()`,
      kicker: 'Deep time',
      // no chapter sits at 1 Ma, so the last leg's "1 million years ago" only ever meant the clock hadn't reached Today
      counter: { expr: `(() => { const ma = Math.round(-__takipHistory.deepClock.time() / 1e6); return ma >= 2 ? ma : null; })()`, unit: '{n} million years ago' },
      beats: [
        // the hook sets off for the first chapter
        { ...hook, enter: go(told[0].i, leg(startMa, told[0].ch.ma)), minMs: leg(startMa, told[0].ch.ma) },
        ...chapters,
        // back to where the clock and camera began, so the loop's last frame meets its first
        { ...outro, enter: backToStart(`(() => { const c = __takipHistory.deepClock; c.pause(); c.seek(${-startMa * 1e6}); })()`) },
      ],
      sources: ['Plates: Cao et al. 2024 (CC BY 4.0)', 'TAKIP'],
      post: {
        title: `${startMa} million years of Earth in under a minute`,
        description: `How the continents moved, from ${told[0].ch.title.toLowerCase()} to today, on TAKIP's deep time map. ` +
          'Plate model by Cao et al. 2024. Explore it yourself at takip.dev.',
        hashtags: ['#TAKIP', '#DeepTime', '#Pangaea', '#Geology', '#EarthHistory', '#Maps'],
      },
    };
  },
};
