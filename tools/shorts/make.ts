/** One short from start to finish: scene, scripts, voice, timeline, film, and the text to post with it. */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { film } from './capture/film';
import { mixTrack, replaceAudio } from './narrate/mix';
import { musicBed } from './narrate/music';
import { scripts } from './narrate/script';
import { ensureSpeech, voiceLine } from './narrate/voice';
import { lay, readWav, writeWav } from './narrate/wav';
import type { Scene, Script } from './scene';
import { closed, plainIfGrave, trimmed } from './loop';
import { context, type Maker } from './stories/context';
import { layout, type Voice } from './timeline';

export const ROOT = resolve(import.meta.dirname, '../..');

export interface MakeOptions {
  langs: string[];
  base: string;
  args: Record<string, string>;
  /** Folder name under data/shorts; today by default. */
  day: string;
  limitMs?: number;
  /** Stop once the scripts are written, to read or edit them first. */
  scriptOnly?: boolean;
  /** Leave out the music bed. */
  noMusic?: boolean;
}

/** The caption bands: a tour's top band sits under the app's bar; a story's under its counter, title and chip. */
// a History tour keeps its captions under the title and chip, and above History's folded key card at about 60% of the height
const CAPTION_BANDS = { app: { top: 0.18, bottom: 0.63 }, 'map-only': { top: 0.42, bottom: 0.63 }, history: { top: 0.42, bottom: 0.52 } } as const;

function postText(scene: Scene, script: Script) {
  return [script.post.title, '', script.post.description, '', script.post.hashtags.join(' '), '', `${script.ui.sources}: ${scene.sources.join(' · ')}`, ''].join('\n');
}

/** Options that change only the words, not which short it is, so they stay out of its folder name. */
const UNNAMED = new Set(['variant', 'length', 'pace']);

/** Whether a folder holds the long cut's lines (a tour's long lines are its `tour` cache). */
const longWritten = (dir: string, maker: Maker) =>
  existsSync(join(dir, 'cache.lines.long.json')) && (maker.id !== 'feature' || existsSync(join(dir, 'cache.tour.long.json')));

/**
 * A short's folder name: `--name`, or the maker and its options. `--angle` stays in it, or an angled tour would film over
 * the plain one of the same page.
 */
export const slugFor = (maker: Maker, args: Record<string, string>) =>
  args.name ?? [maker.id, ...Object.entries(args).filter(([k]) => !UNNAMED.has(k)).map(([k, v]) => `${k}-${v}`)].join('-').replace(/[^a-z0-9-]+/gi, '_').slice(0, 80);

/** Makes one short and returns its folder. */
export async function make(maker: Maker, opts: MakeOptions): Promise<string> {
  const slug = slugFor(maker, opts.args);
  const dir = join(ROOT, 'data/shorts', opts.day, slug);
  mkdirSync(dir, { recursive: true });
  console.log(`${maker.id} → ${relative(ROOT, dir)}`);

  // a short whose folder already has the long cut's lines takes that cut's opening at a short's pace: no new writing
  const long = opts.args.length === 'long';
  const fromLong = !long && longWritten(dir, maker);
  const made = plainIfGrave(await maker.make(context(dir, opts.base, fromLong ? { ...opts.args, length: 'long', pace: 'short' } : opts.args)), slug, opts.args.variant);
  const scene = long ? closed(made) : fromLong ? trimmed(made) : made;
  if (fromLong) console.log(`  short from the long cut's lines: ${scene.beats.length - 2} of its ${made.beats.length - 2} beats`);
  writeFileSync(join(dir, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
  const all = await scripts(dir, scene, opts.langs);
  if (opts.scriptOnly) {
    console.log(`  scripts written; edit script.<lang>.json and run again without --script-only`);
    return dir;
  }

  await ensureSpeech();
  const music = opts.noMusic ? null : await musicBed(dir, all.en);
  for (const lang of opts.langs) {
    const script = all[lang];
    const voiceDir = join(dir, 'voice', lang);
    const voices: Record<string, Voice> = {};
    const clips: Record<string, string> = {};
    for (const line of script.beats) {
      const take = await voiceLine(voiceDir, line.spoken ?? line.say, lang, line.say);
      voices[line.id] = { ms: take.ms, speech: take.speech };
      clips[line.id] = take.wav;
    }
    const timeline = layout(scene.beats, script, voices, CAPTION_BANDS[scene.captions ?? scene.chrome], scene.loop !== false);
    const narration = join(voiceDir, 'narration.wav');
    writeFileSync(narration, writeWav(lay(timeline.beats.map(b => ({ atMs: b.voiceAt, pcm: readWav(readFileSync(clips[b.id])) })), timeline.totalMs)));
    const audio = join(voiceDir, 'mix.wav');
    await mixTrack({ narration, music, out: audio, totalMs: timeline.totalMs, loop: timeline.loop });
    writeFileSync(join(dir, `timeline.${lang}.json`), JSON.stringify(timeline, null, 2) + '\n');
    console.log(`  ${lang}: ${(timeline.totalMs / 1000).toFixed(1)} s, ${timeline.frames} frames`);

    // a --seconds preview is cut short, so it must never pass for the finished video
    const out = join(dir, opts.limitMs ? `${lang}.preview.mp4` : `${lang}.mp4`);
    await film({ base: opts.base, scene, script, timeline, audio, out, cover: join(dir, `${lang}.jpg`), limitMs: opts.limitMs });
    writeFileSync(join(dir, `${lang}.post.txt`), postText(scene, script));
    console.log(`  ${lang}: ${relative(ROOT, out)}`);
  }
  return dir;
}

/** Puts a new soundtrack (narration and, unless left out, the story's music) under videos already filmed in `dir`. */
export async function remix(dir: string, opts: { langs?: string[]; noMusic?: boolean }) {
  const en = JSON.parse(readFileSync(join(dir, 'script.en.json'), 'utf8')) as Script;
  const music = opts.noMusic ? null : await musicBed(dir, en);
  const langs = opts.langs ?? readdirSync(dir).filter(f => /^[a-z]{2}\.mp4$/.test(f)).map(f => f.slice(0, 2));
  for (const lang of langs) {
    const video = join(dir, `${lang}.mp4`);
    const narration = join(dir, 'voice', lang, 'narration.wav');
    if (!existsSync(video) || !existsSync(narration)) {
      console.warn(`  ! ${lang}: no video or narration to remix`);
      continue;
    }
    const { totalMs, loop } = JSON.parse(readFileSync(join(dir, `timeline.${lang}.json`), 'utf8')) as { totalMs: number; loop?: boolean };
    const mix = join(dir, 'voice', lang, 'mix.wav');
    await mixTrack({ narration, music, out: mix, totalMs, loop: loop !== false });
    const tmp = join(dir, `${lang}.remix.mp4`);
    await replaceAudio(video, mix, tmp);
    renameSync(tmp, video);
    console.log(`  ${lang}: ${relative(ROOT, video)}`);
  }
}
