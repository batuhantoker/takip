'use client';

import { Eye, Loader2, ScanSearch, Timer, X } from 'lucide-react';
import { VEHICLES, type Detection, type Label } from '@/lib/intel/vision/detect';
import { countWords, describeWatch, labelWord, lightWord } from '@/lib/intel/vision/analysis';
import { clearLook, look, sourceOf, type VisionCamera } from '@/lib/intel/vision/store';
import { useT } from '@/components/ui/use-t';
import { useLook } from './use-look';

/**
 * TAKIP — the camera's analysis overlay.
 *
 * Analyze counts what is in the current frame; Watch follows the feed for half
 * a minute and reports how it changed. Either runs on the reader's own device,
 * free, with the detector in a worker. TI looks through the same
 * overlay, so whatever it is counting appears here too.
 *
 * The analysed frame is drawn with its boxes in one SVG, so the boxes sit on
 * the picture exactly whether the viewer crops it (cover) or fits it (contain).
 */

const WATCH_SECONDS = 30;

/** People in violet, vehicles in blue, everything else in plain ink. */
function tone(label: Label): string {
  if (label === 'person') return 'var(--violet)';
  return (VEHICLES as readonly string[]).includes(label) ? 'var(--blue)' : 'var(--ink-2)';
}

const clock = (iso: string, locale: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/** A control sitting on the video: dark enough to read over any picture. */
const PILL = 'inline-flex h-7 items-center gap-1.5 rounded-md bg-black/70 px-2.5 text-[12px] font-medium text-ink-1 transition-colors hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function Boxes({ detections }: { detections: Detection[] }) {
  return (
    <>
      {detections.map((d, i) => (
        <rect
          key={i}
          x={d.box[0]} y={d.box[1]} width={d.box[2]} height={d.box[3]}
          fill="none" stroke={tone(d.label)} strokeWidth={1.5} vectorEffect="non-scaling-stroke"
          strokeOpacity={0.55 + d.score * 0.45}
        >
          <title>{`${d.label} · ${Math.round(d.score * 100)}%`}</title>
        </rect>
      ))}
    </>
  );
}

export default function CameraVision({ camera, fit, ready }: { camera: VisionCamera; fit: 'cover' | 'contain'; ready: boolean }) {
  const t = useT();
  const state = useLook(camera.id);
  const source = sourceOf(camera);
  if (!source) return null;

  const busy = state?.status === 'working';
  const a = state?.analysis;
  const start = (watch: number) => { look(camera, { watch, by: 'you' }).catch(() => {}); };

  return (
    <>
      {/* The analysed frame and its boxes, over the live picture. */}
      {state?.frame && a && (
        <svg
          viewBox={`0 0 ${a.width} ${a.height}`}
          preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
          className="absolute inset-0 z-[25] h-full w-full bg-black"
          role="img"
          aria-label={t('Analysed frame: {counts}', { counts: countWords(a.counts, t) })}
        >
          <image href={state.frame} width={a.width} height={a.height} preserveAspectRatio="none" />
          <Boxes detections={a.detections} />
        </svg>
      )}

      {/* TI is looking: say so while it does. */}
      {state?.by === 'ai' && busy && (
        <div className="absolute top-2 right-2 z-30 inline-flex h-6 items-center gap-1.5 rounded-md bg-black/70 px-2 text-[11px] font-medium text-gold">
          <span className="size-1.5 rounded-full bg-gold motion-safe:animate-pulse" /> {t('TI is looking')}
        </div>
      )}

      {/* The controls, until there is something to show. */}
      {ready && !a && !busy && state?.status !== 'error' && (
        <div className="absolute bottom-2 left-2 z-30 flex items-center gap-1.5">
          <button onClick={() => start(0)} className={PILL} title={t('Count what is in view: free, on this device')}>
            <ScanSearch aria-hidden className="size-3.5" strokeWidth={1.75} /> {t('Count what’s in view')}
          </button>
          <button onClick={() => start(WATCH_SECONDS)} className={PILL} title={t('Follow the feed for {n} seconds and see how it changes', { n: WATCH_SECONDS })}>
            <Timer aria-hidden className="size-3.5" strokeWidth={1.75} /> {t('Watch {n} s', { n: WATCH_SECONDS })}
          </button>
        </div>
      )}

      {/* Working: one frame, or a watch with its progress. */}
      {busy && (
        <div className="absolute bottom-2 left-2 z-30 inline-flex h-7 items-center gap-2 rounded-md bg-black/75 pr-1 pl-2.5 text-[12px] text-ink-1">
          <Loader2 aria-hidden className="size-3.5 animate-spin text-ink-2 motion-reduce:animate-none" />
          {state.mode === 'watch' && state.watch
            ? <span>{t.rich('Watching {progress}', { progress: <span className="font-mono tabular-nums">{t('{elapsed} of {seconds} s', { elapsed: Math.round(state.watch.elapsed), seconds: state.watch.seconds })}</span> })}{a ? ` · ${countWords(a.counts, t)}` : ''}</span>
            : <span>{t('Counting…')}</span>}
          <button onClick={() => clearLook(camera.id)} aria-label={t('Stop')} className="rounded-sm p-1 text-ink-3 hover:text-ink-1"><X className="size-3.5" /></button>
        </div>
      )}
      {busy && state.mode === 'watch' && state.watch && (
        <div className="absolute right-0 bottom-0 left-0 z-30 h-0.5 bg-white/10">
          <div className="h-full bg-ink-2 transition-[width] duration-700" style={{ width: `${(state.watch.elapsed / state.watch.seconds) * 100}%` }} />
        </div>
      )}

      {/* What it found. */}
      {a && !busy && (
        <div className="absolute right-0 bottom-0 left-0 z-[31] bg-surface-0/90 px-3 py-2" aria-live="polite">
          <div className="flex items-center gap-2 text-[11px] text-ink-3">
            <Eye aria-hidden className={state.by === 'ai' ? 'size-3.5 text-gold' : 'size-3.5'} strokeWidth={1.75} />
            <span className="truncate">{state.by === 'ai'
              ? t.rich('TI looked at {time} on this device · {light}', { time: <span className="font-mono tabular-nums">{clock(a.at, t.intl)}</span>, light: lightWord(a.light, t) })
              : t.rich('Counted at {time} on this device · {light}', { time: <span className="font-mono tabular-nums">{clock(a.at, t.intl)}</span>, light: lightWord(a.light, t) })}</span>
            <button onClick={() => clearLook(camera.id)} className="ml-auto shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-ink-2 hover:bg-white/10 hover:text-ink-1">
              {t('Back to live')}
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-1">
            {(Object.entries(a.counts) as [Label, number][]).sort((x, y) => y[1] - x[1]).map(([label, n]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: tone(label) }} />
                <span className="font-mono tabular-nums">{n}</span> {labelWord(label, n, t)}
              </span>
            ))}
            {!Object.keys(a.counts).length && <span className="text-ink-2">{t('Nothing in view it can count')}</span>}
          </div>
          {state.watch?.summary && <div className="mt-0.5 text-[11px] text-ink-2">{describeWatch(state.watch.summary, t)}</div>}
        </div>
      )}

      {state?.status === 'error' && !busy && (
        <div className="absolute right-2 bottom-2 left-2 z-30 flex items-center gap-2 rounded-md bg-black/80 px-2.5 py-1.5 text-[12px] text-red">
          <span className="truncate">{state.error}</span>
          <button onClick={() => clearLook(camera.id)} aria-label={t('Dismiss')} className="ml-auto rounded-sm p-0.5 text-ink-3 hover:text-ink-1"><X className="size-3.5" /></button>
        </div>
      )}
    </>
  );
}
