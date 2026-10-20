/** Films one language's cut: opens the app, freezes its clocks, and for every frame steps time, waits for the data, and hands a JPEG to ffmpeg. */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { WORDMARK } from '../../../src/components/shell/brand/geometry.generated';
import { rampFor } from '../../../src/lib/history/series';
import type { Scene, Script } from '../scene';
import { FPS, FRAME_MS, frameAt, type Timeline } from '../timeline';
import { Page } from './browser';

const OVERLAY = readFileSync(new URL('./overlay.js', import.meta.url), 'utf8');
/** 1080 × 1920 from a phone-sized page, so the app lays itself out as on a phone. */
export const VIEWPORT = { width: 432, height: 768, scale: 2.5 };
const READY = `window.__takipMap && !document.querySelector('.z-\\\\[999\\\\]') && !window.__takipMap.isMoving()`;
// not map.loaded(): a layer that restyles itself every frame keeps that false for good
const quietWhen = (waitOn?: string) => `__takipMap.isStyleLoaded() && __takipMap.areTilesLoaded() && ` +
  (waitOn ? `!__shortsClock.inflightUrls().some(u => new RegExp(${JSON.stringify(waitOn)}).test(u))` : '__shortsClock.inflight() === 0');
/** A frame waits at most this long for tiles and data, then is taken as it is. */
const QUIET_CAP_MS = 8000;
/** Time run before the first frame, so labels and layers have faded in. */
const PREROLL_MS = 1500;
const COVER_MS = 1200;
const TAP_MS = 500;
/** How long a tap's `expect` may take in real time: a panel's first open compiles its code on the dev server. */
const TAP_WAIT_MS = 20_000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let capped = 0;

async function quiet(page: Page, when: string) {
  const until = Date.now() + QUIET_CAP_MS;
  for (;;) {
    await page.run('__shortsClock.advance(0)');
    if (await page.evaluate<boolean>(when)) break;
    if (Date.now() > until) {
      // say what held the frame, now and then, so a slow source can be found
      if (capped++ % 20 === 0) {
        const why = await page.evaluate(`({ style: __takipMap.isStyleLoaded(), tiles: __takipMap.areTilesLoaded(), requests: __shortsClock.inflightUrls() })`);
        console.warn(`\n  ! a frame waited ${QUIET_CAP_MS / 1000} s for: ${JSON.stringify(why)}`);
      }
      break;
    }
    await sleep(40);
  }
  await page.run('__shortsClock.advance(0)');
}

export interface FilmJob {
  base: string;
  scene: Scene;
  script: Script;
  timeline: Timeline;
  audio: string;
  out: string;
  cover: string;
  /** Stop after this many ms, for a quick look. */
  limitMs?: number;
}

export async function film({ base, scene, script, timeline, audio, out, cover, limitMs }: FilmJob) {
  const frames = Math.min(timeline.frames, limitMs ? Math.round(limitMs / FRAME_MS) : Infinity);
  const when = quietWhen(scene.waitOn);
  const page = await Page.open({ viewport: VIEWPORT, locale: script.lang });
  const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = once(ffmpeg, 'close');
  try {
    await page.goto(base + scene.path);
    const ready = scene.ready ? `${READY} && (${scene.ready})` : READY;
    if (!(await page.waitFor(ready, 90_000))) throw new Error(`${scene.path} never became ready to film`);
    // the opening camera flight and the view link's own steps run after the splash
    await sleep(2500);
    await page.waitFor(ready, 20_000);
    if (scene.setup) await page.run(scene.setup);
    await page.evaluate(OVERLAY);
    const config = {
      lang: script.lang, rtl: script.lang === 'ar', unspaced: ['zh', 'ja'].includes(script.lang), mapOnly: scene.chrome === 'map-only',
      wordmark: WORDMARK, credit: scene.sources[0] ?? '', sources: `${script.ui.sources}: ${scene.sources.join(' · ')}`,
      legend: scene.legend && script.legend ? { label: script.legend, ramp: rampFor(true) } : null,
      counter: scene.counter && script.unit ? { unit: script.unit, digits: scene.counter.digits ?? 0, kind: scene.counter.kind ?? 'number', bce: script.ui.bce } : null,
    };
    await page.run(`__shortsOverlay.init(${JSON.stringify(config)})`);
    await page.run('__shortsClock.freeze()');
    for (let t = 0; t < PREROLL_MS; t += FRAME_MS) await page.run(`__shortsClock.advance(${FRAME_MS})`);
    await quiet(page, when);

    let current = -1;
    let tap: { x: number; y: number; at: number } | null = null;
    const started = Date.now();
    for (let f = 0; f < frames; f++) {
      const t = f * FRAME_MS;
      if (f) await page.run(`__shortsClock.advance(${FRAME_MS})`);
      const i = Math.max(0, timeline.beats.findIndex(b => t < b.end));
      const beat = scene.beats[i];
      const span = timeline.beats[i];
      if (i !== current) {
        current = i;
        if (beat.enter) await page.run(beat.enter);
      }
      if (beat.frame) await page.run(`((p, ms) => { ${beat.frame} })(${(t - span.start) / (span.end - span.start)}, ${t - span.start})`);
      for (const due of beat.taps ?? []) {
        // by frame number: comparing times in ms, a tap on a frame boundary fired twice and undid itself
        if (Math.round((span.start + due.at) / FRAME_MS) !== f) continue;
        // the element's own click: a synthetic touch was dropped now and then, which put the next tap out of step
        const at = await page.evaluate<[number, number] | null>(`(() => { const e = document.querySelector(${JSON.stringify(due.selector)}); if (!e) return null; const r = e.getBoundingClientRect(); e.click(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
        if (!at) {
          console.warn(`\n  ! nothing to tap at ${due.selector}`);
          continue;
        }
        tap = { x: at[0], y: at[1], at: t };
        if (due.expect && !(await page.waitFor(due.expect, TAP_WAIT_MS))) console.warn(`\n  ! ${due.selector} did not take within ${TAP_WAIT_MS / 1000} s`);
      }
      const ring = tap && t - tap.at < TAP_MS ? { x: tap.x, y: tap.y, p: (t - tap.at) / TAP_MS } : null;
      const count = scene.counter ? await page.evaluate<number | null>(scene.counter.expr).catch(() => null) : null;
      const legend = scene.legend ? await page.evaluate<{ lo: number; hi: number } | null>(scene.legend.expr).catch(() => null) : null;
      await page.run(`__shortsOverlay.draw(${JSON.stringify({ ...frameAt(timeline, script, t), count, legend, tap: ring })})`);
      await quiet(page, when);
      // SHORTS_TRACE="page expression" logs its value each frame, to see what the page does between taps
      if (process.env.SHORTS_TRACE) console.log(`\n  ${f} ${Math.round(t)} ms: ${JSON.stringify(await page.evaluate(process.env.SHORTS_TRACE).catch(e => String(e)))}`);
      const jpeg = await page.screenshot('jpeg', 96);
      if (Math.abs(t - COVER_MS) < FRAME_MS / 2) writeFileSync(cover, jpeg);
      if (!ffmpeg.stdin.write(jpeg)) await once(ffmpeg.stdin, 'drain');
      if (f % (FPS * 2) === 0 || f === frames - 1) {
        const rate = (f + 1) / ((Date.now() - started) / 1000);
        process.stdout.write(`\r  ${script.lang}: ${f + 1}/${frames} frames, ${rate.toFixed(1)} fps   `);
      }
    }
    process.stdout.write('\n');
  } finally {
    ffmpeg.stdin.end();
    await page.close();
  }
  const [code] = await done;
  if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
}
