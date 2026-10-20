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

function postText(scene: Scene, script: Script) {
  return [script.post.title, '', script.post.description, '', script.post.hashtags.join(' '), '', `${script.ui.sources}: ${scene.sources.join(' · ')}`, ''].join('\n');
}

/** A short's folder name: `--name`, or the maker and its options. */
export const slugFor = (maker: Maker, args: Record<string, string>) =>
  args.name ?? [maker.id, ...Object.entries(args).map(([k, v]) => `${k}-${v}`)].join('-').replace(/[^a-z0-9-]+/gi, '_').slice(0, 80);

/** Makes one short and returns its folder. */
export async function make(maker: Maker, opts: MakeOptions): Promise<string> {
  const slug = slugFor(maker, opts.args);
  const dir = join(ROOT, 'data/shorts', opts.day, slug);
  mkdirSync(dir, { recursive: true });
  console.log(`${maker.id} → ${relative(ROOT, dir)}`);

  const scene = await maker.make(context(dir, opts.base, opts.args));
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
    const timeline = layout(scene.beats, script, voices);
    const narration = join(voiceDir, 'narration.wav');
    writeFileSync(narration, writeWav(lay(timeline.beats.map(b => ({ atMs: b.voiceAt, pcm: readWav(readFileSync(clips[b.id])) })), timeline.totalMs)));
    const audio = join(voiceDir, 'mix.wav');
    await mixTrack({ narration, music, out: audio, totalMs: timeline.totalMs });
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
    const { totalMs } = JSON.parse(readFileSync(join(dir, `timeline.${lang}.json`), 'utf8')) as { totalMs: number };
    const mix = join(dir, 'voice', lang, 'mix.wav');
    await mixTrack({ narration, music, out: mix, totalMs });
    const tmp = join(dir, `${lang}.remix.mp4`);
    await replaceAudio(video, mix, tmp);
    renameSync(tmp, video);
    console.log(`  ${lang}: ${relative(ROOT, video)}`);
  }
}
