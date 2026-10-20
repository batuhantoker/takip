/**
 * Earth's plates through deep time, told by History's own documentary: each beat opens a chapter, and the app
 * runs its clock and camera there exactly as it does for a reader. The words come from the chapters' text.
 */
import { CHAPTERS, legMs } from '../../../src/lib/history/paleo/story';
import { askJson } from '../narrate/llm';
import type { Beat } from '../scene';
import type { Maker } from './context';

/** The chapters told by default, by age in millions of years: Pangaea's end to today, under a minute. */
const DEFAULT_CHAPTERS = [252, 201, 66, 50, 0];
const SETTLE_MS = 1200;
const ZOOM_IN = 0.5;

const SYSTEM = `You write voiceover for short vertical videos about Earth's history, read by a calm documentary narrator.
Use only the facts you are given. One sentence per line, at most 18 words, present tense, no hype words,
no questions, no exclamation marks. Reply with JSON only.`;

export const deepTime: Maker = {
  id: 'deep-time',
  kind: 'story',
  about: 'Continents drifting through deep time, chapter by chapter (--chapters 252,201,66,50,0)',
  async make(ctx) {
    const wanted = (ctx.args.chapters?.split(',').map(Number) ?? DEFAULT_CHAPTERS);
    const told = CHAPTERS.map((ch, i) => ({ ch, i })).filter(({ ch }) => wanted.includes(ch.ma));
    if (!told.length) throw new Error(`no chapters at ${wanted.join(', ')} Ma; there are ${CHAPTERS.map(c => c.ma).join(', ')}`);
    const startMa = Math.min(1800, Math.ceil((told[0].ch.ma + 20) / 50) * 50);
    const id = (ma: number) => `ma-${ma}`;

    const lines = await ctx.once('lines', () => askJson<{ hook: string; lines: Record<string, string> }>(SYSTEM,
      `Write a hook and one narration line for each chapter below. Each line tells only its own chapter, from that chapter's ` +
      `facts alone. The hook is at most 12 words, opens the video and makes people stay; it says the video covers ` +
      `${startMa} million years in under a minute.\n\n` +
      told.map(({ ch }) => `[${id(ch.ma)}] ${ch.title}, ${ch.ma} million years ago: ${ch.body}`).join('\n') +
      `\n\nReturn {"hook": "...", "lines": {${told.map(({ ch }) => `"${id(ch.ma)}": "..."`).join(', ')}}}.`,
      { check: v => (v.hook && told.every(({ ch }) => v.lines?.[id(ch.ma)]?.trim()) ? null : 'need the hook and a line for every chapter id') }));

    const go = (i: number) => `__takipHistory.story.go(${i})`;
    let ma = startMa;
    const chapters: Beat[] = told.map(({ ch, i }, n) => {
      // the hook already set off for the first chapter
      const beat: Beat = { id: id(ch.ma), say: lines.lines[id(ch.ma)], title: ch.title, ...(n ? { enter: go(i), minMs: legMs(ma, ch.ma) + SETTLE_MS } : {}) };
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
      setup: `(() => { __takipHistory.deepClock.pause(); const m = __takipMap, fly = m.flyTo.bind(m); m.flyTo = (o, e) => fly({ ...o, zoom: (o.zoom ?? m.getZoom()) + ${ZOOM_IN} }, e); })()`,
      kicker: 'Deep time',
      counter: { expr: `(() => { const ma = Math.round(-__takipHistory.deepClock.time() / 1e6); return ma > 0 ? ma : null; })()`, unit: '{n} million years ago' },
      beats: [
        { id: 'hook', card: 'hook', say: lines.hook, enter: go(told[0].i), minMs: legMs(startMa, told[0].ch.ma) },
        ...chapters,
        { id: 'outro', card: 'end', say: 'Every plate and every era is on TAKIP. Scrub through it yourself.' },
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
