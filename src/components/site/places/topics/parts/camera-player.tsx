'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

/** A camera whose video the page can play, captioned, with its place on the map. */
export interface PlayerCamera { key: string; name: string; meta: string; href: string; kind: 'hls' | 'mp4'; url: string }

/**
 * One player for a place whose nearest cameras send video rather than stills. Nothing loads until the reader presses
 * Play, so a visit costs no video it didn't ask for; the other cameras switch the player.
 */
export function CameraPlayer({ cameras, labels }: {
  cameras: PlayerCamera[];
  labels: { play: string; failed: string; onMap: string };
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const cam = cameras[index];

  useEffect(() => {
    const el = video.current;
    if (!playing || !el) return;
    if (cam.kind === 'mp4') {
      el.src = cam.url;
      el.play().catch(() => {});
      return () => { el.removeAttribute('src'); el.load(); };
    }
    // The decoder first, as the map does: Chrome says "maybe" to HLS whether or not it can play it.
    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = cam.url;
          el.play().catch(() => {});
        } else setFailed(true);
        return;
      }
      const instance = new Hls({ enableWorker: false, maxBufferLength: 10 });
      hls = instance;
      instance.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) setFailed(true); });
      instance.loadSource(cam.url);
      instance.attachMedia(el);
      el.play().catch(() => {});
    }).catch(() => setFailed(true));
    return () => {
      cancelled = true;
      hls?.destroy();
      el.removeAttribute('src');
      el.load();
    };
  }, [playing, cam]);

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-float border border-line bg-surface-1 shadow-float">
        {playing && <video ref={video} muted playsInline autoPlay controls onError={() => setFailed(true)} className="size-full bg-black object-contain" />}
        {!playing && (
          <button type="button" onClick={() => { setFailed(false); setPlaying(true); }}
            className={cx('group absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-1', FOCUS_RING)}>
            <span className={cx('flex size-14 items-center justify-center rounded-full bg-accent text-on-accent group-hover:bg-accent/90', TRANSITION)}>
              <Play className="size-6 translate-x-0.5" aria-hidden />
            </span>
            <span className="text-[14px] font-medium">{labels.play}</span>
          </button>
        )}
        {playing && failed && (
          <p className="absolute inset-x-3 bottom-3 rounded-control border border-line bg-surface-0/90 px-3 py-2 text-[13px] text-ink-2">{labels.failed}</p>
        )}
      </div>
      <p className="mt-2 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate"><span className="font-medium text-ink-1">{cam.name}</span> <span className="text-ink-3">· {cam.meta}</span></span>
        <a href={cam.href} className={cx('flex-shrink-0 text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink-1', FOCUS_RING)}>{labels.onMap}</a>
      </p>
      {cameras.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {cameras.map((c, i) => (
            <li key={c.key} className="min-w-0 max-w-full">
              <button type="button" aria-pressed={i === index} onClick={() => { setFailed(false); setIndex(i); }}
                className={cx('inline-flex h-8 max-w-full items-center rounded-control border px-2.5 text-[13px]', FOCUS_RING, TRANSITION,
                  i === index ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-line bg-surface-1 text-ink-2 hover:text-ink-1')}>
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
