/**
 * One instrumental bed per story, made by the AI-models panel's Speech service (MiniMax Music 3 through mlx-audio).
 * Claude writes the brief from the story, and the seed comes from the story's id, so no two shorts share a track.
 * It is made once, long enough for any language's cut, and kept as music.wav in the short's folder.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Script } from '../scene';
import { askJson } from './llm';
import { ensureSpeech } from './voice';
import { durationMs, readWav } from './wav';

const SPEECH = process.env.SHORTS_TTS_URL ?? 'http://127.0.0.1:8880';
/** Longer than any short; a mix trims it to the cut. */
const BED_S = 90;
/** The model ends a piece when it likes (often after 20–30 s), so takes are joined until the bed is this long. */
const ENOUGH_S = 75;
const MAX_TAKES = 5;
const CROSSFADE_S = 3;

const seconds = (wav: Buffer) => durationMs(readWav(wav)) / 1000;

function ffmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
}

async function take(caption: string, seed: number) {
  const res = await fetch(`${SPEECH}/v1/audio/music`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption, duration: BED_S, seed }),
    signal: AbortSignal.timeout(1_800_000),
  });
  if (!res.ok) throw new Error(`music: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const SYSTEM = `You write briefs for a music model that makes instrumental background music for short documentary videos
about maps and history. Reply with JSON only.`;

export async function musicBed(dir: string, en: Script): Promise<string> {
  const file = join(dir, 'music.wav');
  if (existsSync(file)) return file;
  const briefFile = join(dir, 'cache.music.json');
  const brief = existsSync(briefFile)
    ? (JSON.parse(readFileSync(briefFile, 'utf8')) as { caption: string; seed: number })
    : {
      ...(await askJson<{ caption: string }>(SYSTEM,
        `The video: "${en.post.title}" (${en.kicker}). It opens: "${en.beats[0]?.say}".\n` +
        `Write a one-sentence caption for its background music: genre, two or three instruments, tempo and mood that suit ` +
        `this story. It sits quietly under a narrator, so: no vocals, no drops, a steady low-key underscore.\n` +
        `Return {"caption": "..."}.`, { check: v => (v.caption?.trim() ? null : 'need a caption') })),
      seed: parseInt(createHash('sha1').update(basename(dir)).digest('hex').slice(0, 8), 16) % 100000,
    };
  writeFileSync(briefFile, JSON.stringify(brief, null, 2) + '\n');
  await ensureSpeech();
  console.log(`  music: ${brief.caption}`);
  // the same brief with the next seeds, so the takes share a mood but don't repeat
  const takes: string[] = [];
  for (let total = 0, i = 0; total < ENOUGH_S && i < MAX_TAKES; i++) {
    const wav = await take(brief.caption, brief.seed + i);
    const path = join(dir, `music.take${i}.wav`);
    writeFileSync(path, wav);
    takes.push(path);
    total += seconds(wav) - (i ? CROSSFADE_S : 0);
  }
  const chain = takes.slice(1).map((_, i) => `[${i ? `j${i}` : '0'}][${i + 1}]acrossfade=d=${CROSSFADE_S}:c1=tri:c2=tri${i === takes.length - 2 ? '' : `[j${i + 1}]`}`).join(';');
  if (takes.length > 1) await ffmpeg([...takes.flatMap(t => ['-i', t]), '-filter_complex', chain, file]);
  else writeFileSync(file, readFileSync(takes[0]));
  takes.forEach(t => rmSync(t));
  return file;
}
