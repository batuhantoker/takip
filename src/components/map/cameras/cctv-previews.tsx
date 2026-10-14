'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { freshen, previewMedia, refreshInterval, VIDEO_KINDS, type PreviewKind } from '@/lib/cameras/preview';
import { layoutTile, tileHeight, tilesOverlap, type TileGeometry } from '@/lib/cameras/tile-layout';
import type { Map as MlMap } from 'maplibre-gl';

/**
 * TAKIP — live CCTV previews on the map
 *
 * Zoom in far enough on a cluster of cameras and the nearest ones stop being
 * dots and start showing what they see: a small live frame pinned above each
 * marker, captioned with the camera's name.
 *
 * Most of the ~19,000 are JPEG snapshot feeds, which cost one request per
 * refresh. The ones that are video get a tile too — Quebec 511 alone is 675
 * MP4 cameras, and leaving them as dots read as "no camera here" rather than
 * "this one needs a player" — but no more than MAX_VIDEO_TILES play at once,
 * because decoding is what the frame budget actually goes on. Beyond that a
 * video camera stays a dot and opens on click, as embeds always do.
 *
 * Positions are written straight to the DOM on every map `move`, so panning
 * does not re-render React 60 times a second. Which cameras are shown is
 * recomputed only when the map settles.
 */

const MIN_ZOOM = 13;
const MAX_TILES = 8;
/** Simultaneously decoding tiles. Snapshots fill whatever is left of MAX_TILES. */
const MAX_VIDEO_TILES = 4;

/** 16:9 frame, so nothing is letterboxed inside its own container. */
const GEOM: TileGeometry = { width: 176, imageHeight: 99, labelHeight: 20, gap: 26 };
const TILE_W = GEOM.width;
const IMG_H = GEOM.imageHeight;
const LABEL_H = GEOM.labelHeight;
const GAP = GEOM.gap;
const TILE_H = tileHeight(GEOM);

/** Placement lives in lib/cameras/tile-layout — the live-news tiles share it. */
function layout(pt: { x: number; y: number }, width: number, height: number) {
  return layoutTile(pt, { width, height }, GEOM);
}

/** Whatever the camera layer is currently drawn in — see lib/map/palette. */
const CAM = 'var(--map-cctv)';
/** color-mix keeps every tint tied to that property, not to a frozen hex. */
const cam = (pct: number) => `color-mix(in srgb, ${CAM} ${pct}%, transparent)`;

export interface PreviewCamera {
  id: string;
  name: string;
  lng: number;
  lat: number;
  feed_url: string;
  city?: string;
  country?: string;
  source?: string;
  stream_url?: string;
  stream_type?: string;
  external_url?: string;
  /** Resolved once during selection — see lib/cameras/preview. */
  media: { kind: PreviewKind; url: string };
}

interface MediaProps {
  cam: PreviewCamera;
  onReady: () => void;
  onFail: () => void;
}

const FIT = 'h-full w-full object-cover transition-opacity duration-500';

/** Snapshot and MJPEG feeds: an <img>, re-requested only if its kind needs it. */
function ImageMedia({ cam: camera, onReady, onFail }: MediaProps) {
  const { kind, url } = camera.media;
  const every = refreshInterval(kind);
  const [src, setSrc] = useState(() => (every ? freshen(url) : url));

  useEffect(() => {
    if (!every) return;
    /* Staggered, so eight tiles do not all hit their origin on the same tick. */
    let interval: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      setSrc(freshen(url));
      interval = setInterval(() => setSrc(freshen(url)), every);
    }, every + Math.random() * 2000);
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [url, every]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- remote camera frames, no loader */
    <img
      src={src}
      alt={camera.name}
      width={TILE_W}
      height={IMG_H}
      className={FIT}
      onLoad={onReady}
      onError={onFail}
      draggable={false}
    />
  );
}

/**
 * MP4 clips and HLS streams.
 *
 * Muted and inline, which is what browsers require before they will autoplay
 * anything without a gesture. hls.js is imported only when an HLS tile is
 * actually on screen: it is a decoder, and the overwhelming majority of tiles
 * never need it.
 */
function VideoMedia({ cam: camera, onReady, onFail }: MediaProps) {
  const { kind, url } = camera.media;
  const ref = useRef<HTMLVideoElement>(null);
  /* MP4 clips are a few seconds long and loop, so they go stale; re-pointing
     the element is what refreshes them. HLS is already live and returns 0. */
  const [cacheBust, setCacheBust] = useState(0);
  const every = refreshInterval(kind);

  useEffect(() => {
    if (!every) return;
    const t = setInterval(() => setCacheBust(n => n + 1), every + Math.random() * 4000);
    return () => clearInterval(t);
  }, [every]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (kind === 'mp4') {
      el.src = cacheBust ? freshen(url) : url;
      el.play().catch(() => { /* autoplay refused: the frame still shows */ });
      return;
    }

    /* HLS: the decoder first, native playback only as the fallback — the same
       order the full viewer uses. Chrome answers `canPlayType` for HLS with
       "maybe" whether or not the build can actually decode it, so trusting it
       first would leave a dead tile on every build that cannot. */
    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !ref.current) return;
      if (!Hls.isSupported()) {
        if (ref.current.canPlayType('application/vnd.apple.mpegurl')) {
          ref.current.src = url;
          ref.current.play().catch(() => {});
        } else {
          onFail();
        }
        return;
      }
      /* A short buffer: eight of these would otherwise each hold seconds of
         video for a tile the size of a postage stamp. */
      const instance = new Hls({ enableWorker: false, maxBufferLength: 6 });
      hls = instance;
      instance.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) onFail(); });
      instance.loadSource(url);
      instance.attachMedia(ref.current);
      ref.current.play().catch(() => {});
    }).catch(onFail);

    return () => { cancelled = true; hls?.destroy(); };
  }, [kind, url, cacheBust, onFail]);

  return (
    <video
      ref={ref}
      className={FIT}
      muted
      playsInline
      loop
      autoPlay
      preload="auto"
      onLoadedData={onReady}
      onError={onFail}
    />
  );
}

function Tile({ cam: camera, onOpen }: { cam: PreviewCamera; onOpen: (cam: PreviewCamera) => void }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* No reset needed on the way in: each tile is keyed by camera id, so a slot
     changing hands remounts this component with fresh state. */
  const onReady = useCallback(() => setLoaded(true), []);
  const onFail = useCallback(() => setFailed(true), []);

  /* A camera that will not load is worse than no tile: it is a broken box
     sitting over the map claiming to be a feed. */
  if (failed) return null;

  const video = VIDEO_KINDS.has(camera.media.kind);
  return (
    <button
      onClick={() => onOpen(camera)}
      title={`${camera.name} · open the player`}
      className="cctv-tile group block w-full overflow-hidden rounded-card border border-line-strong bg-surface-1 text-left shadow-float transition-colors hover:border-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{ width: TILE_W }}
    >
      <div className="relative overflow-hidden bg-black" style={{ height: IMG_H }}>
        <div className="h-full w-full transition-opacity duration-500" style={{ opacity: loaded ? 1 : 0 }}>
          {video
            ? <VideoMedia cam={camera} onReady={onReady} onFail={onFail} />
            : <ImageMedia cam={camera} onReady={onReady} onFail={onFail} />}
        </div>

        {video && loaded && (
          <span className="pointer-events-none absolute top-1.5 left-1.5 inline-flex h-4 items-center gap-1 rounded-[4px] bg-black/70 px-1 text-[11px] leading-none font-medium text-ink-1">
            <span className="size-1.5 rounded-full bg-green" /> Live
          </span>
        )}

        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2 text-[11px] text-ink-3">Loading…</div>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-line px-2 text-[11px] text-ink-2 group-hover:text-ink-1" style={{ height: LABEL_H }}>
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: CAM }} />
        <span className="truncate">{camera.name}</span>
        <Maximize2 aria-hidden className="ml-auto size-3 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.75} />
      </div>
    </button>
  );
}

/**
 * The line from a tile to the marker it belongs to.
 *
 * Without one, eight frames float over the map with nothing saying which
 * camera each belongs to — at this zoom the dots are dense enough that the
 * nearest one is a guess. Which end it hangs from is decided by `place()`,
 * since only that knows whether the tile had room above its marker; both are
 * rendered and globals.css hides the one that does not apply.
 */
function Connector() {
  return (
    <>
      <span
        className="cctv-stem cctv-stem-down pointer-events-none absolute left-1/2 w-px"
        style={{ top: TILE_H, height: GAP - 5, background: `linear-gradient(to bottom, ${cam(70)}, ${cam(10)})` }}
      />
      <span
        className="cctv-stem cctv-stem-up pointer-events-none absolute left-1/2 w-px"
        style={{ bottom: TILE_H, height: GAP - 5, background: `linear-gradient(to top, ${cam(70)}, ${cam(10)})` }}
      />
    </>
  );
}

function CctvPreviews({ mapRef, active, onOpen }: {
  /* The ref rather than the map: reading `.current` during render is what the
     lint rule forbids, and every use here is inside an effect anyway. */
  mapRef: React.RefObject<MlMap | null>;
  active: boolean;
  onOpen: (cam: PreviewCamera) => void;
}) {
  const [cams, setCams] = useState<PreviewCamera[]>([]);
  const nodes = useRef(new Map<string, HTMLDivElement | null>());

  /** Pick which cameras get a tile. Runs only when the map settles. */
  const recompute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !active || map.getZoom() < MIN_ZOOM) {
      setCams(prev => (prev.length ? [] : prev));
      return;
    }

    let feats;
    try {
      feats = map.queryRenderedFeatures({ layers: ['cctv-dots'] });
    } catch {
      return; // layer not added yet
    }

    const canvas = map.getCanvas();
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;

    const seen = new Set<string>();
    const candidates: { cam: PreviewCamera; box: ReturnType<typeof layout>; d: number }[] = [];

    for (const f of feats) {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const id = String(p.id ?? '');
      if (!id || seen.has(id) || p.offline === true) continue;

      const str = (k: string) => (p[k] ? String(p[k]) : undefined);
      /* What this camera can actually show in a tile. Null means it needs an
         embed, or has no usable URL — either way it stays a dot. */
      const media = previewMedia({ stream_type: str('stream_type'), feed_url: str('feed_url'), stream_url: str('stream_url') });
      if (!media) continue;

      const coords = (f.geometry as { coordinates?: [number, number] })?.coordinates;
      if (!coords) continue;
      seen.add(id);

      const pt = map.project(coords);
      candidates.push({
        cam: {
          id,
          name: String(p.name ?? 'CAMERA'),
          lng: coords[0],
          lat: coords[1],
          feed_url: String(p.feed_url ?? ''),
          city: str('city'),
          country: str('country'),
          source: str('source'),
          stream_url: str('stream_url'),
          stream_type: str('stream_type'),
          external_url: str('external_url'),
          media,
        },
        box: layout(pt, canvas.clientWidth, canvas.clientHeight),
        d: (pt.x - cx) ** 2 + (pt.y - cy) ** 2,
      });
    }

    /* Nearest the middle of the screen first, then drop any tile that would
       land on top of one already taken — overlapping frames read as one
       unusable smear rather than as several cameras. */
    candidates.sort((a, b) => a.d - b.d);
    const picked: typeof candidates = [];
    let videos = 0;
    for (const c of candidates) {
      if (picked.length >= MAX_TILES) break;
      /* Decoding is the expensive part, so the moving tiles are rationed
         separately. A video camera past the cap is skipped rather than
         ending the search: the snapshot behind it can still have the slot. */
      const isVideo = VIDEO_KINDS.has(c.cam.media.kind);
      if (isVideo && videos >= MAX_VIDEO_TILES) continue;
      const clash = picked.some(p => tilesOverlap(p.box, c.box, GEOM));
      if (clash) continue;
      picked.push(c);
      if (isVideo) videos++;
    }

    setCams(prev => {
      const same = prev.length === picked.length && prev.every((p, i) => p.id === picked[i].cam.id);
      return same ? prev : picked.map(p => p.cam);
    });
  }, [mapRef, active]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    /* `moveend` alone is not enough. Arriving somewhere fires it before the
       source tiles for that view have been parsed, so the query comes back
       empty and nothing would ever ask again. `idle` catches the frame after
       rendering settles, and `sourcedata` catches the camera list refreshing
       under a stationary map. */
    const onSourceData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (e.sourceId === 'cctv' && e.isSourceLoaded) recompute();
    };

    recompute();
    map.on('moveend', recompute);
    map.on('zoomend', recompute);
    map.on('idle', recompute);
    map.on('sourcedata', onSourceData);
    return () => {
      map.off('moveend', recompute);
      map.off('zoomend', recompute);
      map.off('idle', recompute);
      map.off('sourcedata', onSourceData);
    };
  }, [mapRef, recompute]);

  /* Keep tiles glued to their markers without re-rendering during a pan. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const place = () => {
      const canvas = map.getCanvas();
      for (const cam of cams) {
        const el = nodes.current.get(cam.id);
        if (!el) continue;
        const box = layout(map.project([cam.lng, cam.lat]), canvas.clientWidth, canvas.clientHeight);
        /* A tile pushed back inside the viewport has been moved off its marker,
           so its connector would point at empty map. Drop the line rather than
           draw something untrue. */
        el.dataset.flip = !box.anchored ? 'none' : box.flipped ? 'below' : 'above';
        el.style.transform = `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0)`;
      }
    };
    place();
    map.on('move', place);
    return () => { map.off('move', place); };
  }, [mapRef, cams]);

  if (!cams.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[40] overflow-hidden">
      {cams.map(cam => (
        <div
          key={cam.id}
          ref={el => { nodes.current.set(cam.id, el); }}
          data-flip="above"
          className="pointer-events-auto absolute left-0 top-0 will-change-transform"
          style={{ width: TILE_W }}
        >
          <Tile cam={cam} onOpen={onOpen} />
          <Connector />
        </div>
      ))}
    </div>
  );
}

export default memo(CctvPreviews);
