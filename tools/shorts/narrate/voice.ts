/**
 * The voiceover: each line spoken by the AI-models panel's Speech service (:8880), then heard back through
 * Whisper to check it and to find where the speech sits in the clip. Clips are cached by their words.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Voice } from '../timeline';
import { durationMs, readWav } from './wav';

const SPEECH = process.env.SHORTS_TTS_URL ?? 'http://127.0.0.1:8880';
const PANEL = process.env.SHORTS_PANEL_URL ?? 'http://127.0.0.1:7860';
export const NARRATOR = process.env.SHORTS_VOICE ?? 'narrator';
/** Above this character error rate a take is redone, up to RETRIES times, keeping the best. */
const MAX_CER = 0.35;
const RETRIES = 2;

/** Where the cloned narrator stumbles a native model reads instead: Chatterbox garbled Japanese (CER ~0.5), Kokoro read it word-perfect. */
const NATIVE: Record<string, { model: string; voice: string; lang_code: string }> = {
  ja: { model: 'mlx-community/Kokoro-82M-bf16', voice: 'jf_alpha', lang_code: 'j' },
};
let narratorVersion: Promise<number> | null = null;
/** The narrator clip's version, so a new recording re-voices every line instead of reusing cached takes. */
const version = () => (narratorVersion ??= fetch(`${SPEECH}/v1/audio/voices`)
  .then(r => r.json() as Promise<{ voices: { name: string; version?: number }[] }>)
  .then(v => v.voices.find(x => x.name === NARRATOR)?.version ?? 0, () => 0));
const voiceOf = async (lang: string) => NATIVE[lang] ? `${NATIVE[lang].model}:${NATIVE[lang].voice}` : `${NARRATOR}@${await version()}`;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const up = () => fetch(`${SPEECH}/`, { signal: AbortSignal.timeout(1500) }).then(r => r.ok, () => false);

/** Starts the panel's Speech service if it is off. */
export async function ensureSpeech() {
  if (await up()) return;
  const res = await fetch(`${PANEL}/api/tts/start`, { method: 'POST', headers: { 'X-Panel': '1', 'Content-Type': 'application/json' }, body: '{}' })
    .catch(() => { throw new Error(`neither Speech (${SPEECH}) nor the AI-models panel (${PANEL}) is running: run \`aimodels\``); });
  if (!res.ok) throw new Error(`the panel could not start Speech: ${await res.text()}`);
  for (let i = 0; i < 120; i++) {
    if (await up()) return;
    await sleep(1000);
  }
  throw new Error('Speech did not come up; see `aimodels logs tts`');
}

async function speak(text: string, lang: string) {
  const res = await fetch(`${SPEECH}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Lower guidance keeps an English reference voice from lending its accent to other languages.
    body: JSON.stringify(NATIVE[lang] ? { input: text, ...NATIVE[lang] }
      : { input: text, lang_code: lang, voice: NARRATOR, cfg_weight: lang === 'en' ? 0.5 : 0.3, exaggeration: 0.5 }),
    signal: AbortSignal.timeout(600_000),
  });
  if (!res.ok) throw new Error(`speech (${lang}): ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function transcribe(wav: Buffer, lang: string) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'line.wav');
  form.append('language', lang);
  const res = await fetch(`${SPEECH}/v1/audio/transcriptions`, { method: 'POST', body: form, signal: AbortSignal.timeout(600_000) });
  if (!res.ok) throw new Error(`transcription (${lang}): ${res.status} ${await res.text()}`);
  return (await res.json()) as { text: string; words: { word: string; start: number; end: number }[] };
}

const letters = (s: string) => Array.from(s.normalize('NFKC').toLowerCase()).filter(c => /\p{L}/u.test(c));

/** Character error rate on letters only, so "200" heard for "two hundred" costs little; Han characters are compared as written. */
export function cer(said: string, heard: string) {
  const a = letters(said), b = letters(heard);
  if (!a.length) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return Math.min(1, row[b.length] / a.length);
}

export interface Take extends Voice { cer: number; heard: string }

/** One line in one language: from the cache, or spoken, checked and cached. `shown` is the caption's text: Whisper
 *  writes "1970" for "nineteen seventy", so a take passes when it matches either. */
export async function voiceLine(dir: string, text: string, lang: string, shown = text): Promise<Take & { wav: string }> {
  const key = createHash('sha1').update(`${await voiceOf(lang)}|${lang}|${text}`).digest('hex').slice(0, 16);
  mkdirSync(dir, { recursive: true });
  const wav = join(dir, `${key}.wav`);
  const meta = join(dir, `${key}.json`);
  if (existsSync(wav) && existsSync(meta)) return { ...(JSON.parse(readFileSync(meta, 'utf8')) as Take), wav };
  let best: { take: Take; audio: Buffer } | null = null;
  for (let attempt = 0; attempt <= RETRIES && !(best && best.take.cer <= MAX_CER); attempt++) {
    const audio = await speak(text, lang);
    const heard = await transcribe(audio, lang);
    const ms = durationMs(readWav(audio));
    const words = heard.words;
    const speech: [number, number] = words.length
      ? [Math.max(0, words[0].start * 1000 - 60), Math.min(ms, words[words.length - 1].end * 1000 + 60)]
      : [0, ms];
    const take = { ms, speech, cer: Math.min(cer(text, heard.text), cer(shown, heard.text)), heard: heard.text.trim() };
    if (!best || take.cer < best.take.cer) best = { take, audio };
  }
  if (!best) throw new Error('no take');
  if (best.take.cer > MAX_CER) console.warn(`  ! ${lang} line may be garbled (CER ${best.take.cer.toFixed(2)}): heard "${best.take.heard}"`);
  writeFileSync(wav, best.audio);
  writeFileSync(meta, JSON.stringify(best.take, null, 2) + '\n');
  return { ...best.take, wav };
}
