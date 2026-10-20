/** When each beat, line and word happens in one language's cut, and what the overlay shows at any moment. */
import type { Beat, Script } from './scene';

export const FPS = 30;
export const FRAME_MS = 1000 / FPS;
/** Quiet before a line and after it. */
const LEAD_MS = 200;
const TAIL_MS = 450;
/** The end card stays up after the last word. */
const END_HOLD_MS = 1800;
const FADE_MS = 250;

export interface Voice {
  ms: number;
  /** Where the speech starts and ends inside the clip; the whole clip when unknown. */
  speech?: [number, number];
}

export interface Word { text: string; start: number; end: number }
export interface Chunk { words: Word[]; start: number; end: number }
export interface TimedBeat {
  id: string;
  card?: 'hook' | 'end';
  start: number;
  end: number;
  voiceAt: number;
  chunks: Chunk[];
}
export interface Timeline { beats: TimedBeat[]; totalMs: number; frames: number }

const UNSPACED = new Set(['zh', 'ja']);
const BREAK_AFTER = /[.,;:!?…—–、。，；：！？」』)）]$/u;

/** A line cut into the pieces a caption highlights one by one: words, found by the language's own word breaker where there are no spaces. */
export function tokens(text: string, lang: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (!UNSPACED.has(lang)) return clean.split(' ');
  const out: string[] = [];
  for (const { segment, isWordLike } of new Intl.Segmenter(lang, { granularity: 'word' }).segment(clean.replace(/ /g, ''))) {
    // punctuation rides with the word before it
    if (!isWordLike && out.length) out[out.length - 1] += segment;
    else out.push(segment);
  }
  return out;
}

/** Groups timed words into caption cards that fit two short lines, breaking after punctuation where it can. */
export function chunk(words: Word[], lang: string): Chunk[] {
  const unspaced = UNSPACED.has(lang);
  const maxChars = unspaced ? 12 : 26;
  const maxWords = unspaced ? 6 : 5;
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const width = (ws: Word[]) => ws.reduce((n, w) => n + w.text.length, 0) + (unspaced ? 0 : Math.max(0, ws.length - 1));
  for (const w of words) {
    if (cur.length && (cur.length >= maxWords || width([...cur, w]) > maxChars)) {
      chunks.push({ words: cur, start: cur[0].start, end: 0 });
      cur = [];
    }
    cur.push(w);
    if (BREAK_AFTER.test(w.text) && width(cur) >= maxChars / 2) {
      chunks.push({ words: cur, start: cur[0].start, end: 0 });
      cur = [];
    }
  }
  if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: 0 });
  chunks.forEach((c, i) => { c.end = chunks[i + 1]?.start ?? c.words[c.words.length - 1].end + TAIL_MS; });
  return chunks;
}

/** Spreads a line's tokens over its speech by length: close enough for highlighting, and right for every script. */
export function timeWords(text: string, lang: string, from: number, to: number): Word[] {
  const parts = tokens(text, lang);
  const weights = parts.map(p => p.length + 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let at = from;
  return parts.map((text, i) => {
    const ms = ((to - from) * weights[i]) / total;
    const word = { text, start: Math.round(at), end: Math.round(at + ms) };
    at += ms;
    return word;
  });
}

const toFrame = (ms: number) => Math.ceil(ms / FRAME_MS) * FRAME_MS;

export function layout(beats: Beat[], script: Script, voices: Record<string, Voice>): Timeline {
  const lines = new Map(script.beats.map(b => [b.id, b.say]));
  let at = 0;
  const timed = beats.map(beat => {
    const voice = voices[beat.id];
    if (!voice) throw new Error(`no voice for beat "${beat.id}" (${script.lang})`);
    const voiceAt = at + LEAD_MS;
    const spoken = LEAD_MS + voice.ms + TAIL_MS;
    const end = at + toFrame(Math.max(beat.minMs ?? 0, spoken) + (beat.card === 'end' ? END_HOLD_MS : 0));
    const [s, e] = voice.speech ?? [0, voice.ms];
    const words = timeWords(lines.get(beat.id) ?? beat.say, script.lang, voiceAt + s, voiceAt + e);
    const chunks = chunk(words, script.lang).map(c => ({ ...c, end: Math.min(c.end, end) }));
    const t: TimedBeat = { id: beat.id, ...(beat.card ? { card: beat.card } : {}), start: at, end, voiceAt, chunks };
    at = end;
    return t;
  });
  return { beats: timed, totalMs: at, frames: Math.round(at / FRAME_MS) };
}

/** What the overlay draws at time t; it has no clock of its own, so every frame is exact. */
export interface OverlayFrame {
  card: 'hook' | 'end' | null;
  /** 0–1: fading in. */
  cardIn: number;
  hook?: { kicker: string; line: string };
  end?: { line: string; explore: string };
  title?: string;
  titleIn: number;
  /** Each word as already said (0), being said (1) or still to come (2). */
  caption?: { text: string; state: 0 | 1 | 2 }[];
  counter: boolean;
}

const fade = (t: number, from: number) => Math.max(0, Math.min(1, (t - from) / FADE_MS));

export function frameAt(timeline: Timeline, script: Script, t: number): OverlayFrame {
  const i = Math.max(0, timeline.beats.findIndex(b => t < b.end));
  const beat = timeline.beats[i] ?? timeline.beats[timeline.beats.length - 1];
  const line = script.beats.find(b => b.id === beat.id);
  const frame: OverlayFrame = { card: beat.card ?? null, cardIn: fade(t, beat.start), titleIn: 0, counter: !beat.card };
  if (beat.card === 'hook') frame.hook = { kicker: script.kicker, line: line?.say ?? '' };
  if (beat.card === 'end') frame.end = { line: line?.say ?? '', explore: script.ui.explore };
  if (!beat.card && line?.title) {
    frame.title = line.title;
    frame.titleIn = fade(t, beat.start);
  }
  const c = beat.card === 'hook' ? undefined : beat.chunks.find(ch => t >= ch.start && t < ch.end);
  if (c) frame.caption = c.words.map(w => ({ text: w.text, state: t >= w.end ? 0 : t >= w.start ? 1 : 2 }));
  return frame;
}
