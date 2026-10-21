'use client';

import { useState, useEffect, useRef } from 'react';
import { CameraOff, ExternalLink, LoaderCircle, LogIn, MapPin, Maximize2, Minimize2, PlayCircle, RefreshCw, X } from 'lucide-react';
import type Hls from 'hls.js';
import { isHostedOffPlatform, liveFeedAtSource, localEmbed, needsResolution, offPlatformView, withdrawalCheck } from '@/lib/feeds/cameras/feed';
import { clearLook, registerVideo } from '@/lib/intel/vision/store';
import { Button, IconButton } from '@/components/ui/button';
import { cx, ENTER } from '@/components/ui/class-names';
import { Dot } from '@/components/ui/tag';
import { useEscape } from '@/components/ui/use-escape';
import { WindowFoldButton, WindowSizeButton } from '@/components/map/windows';
import { useBottomBar } from '@/components/shell/mobile/use-bottom-bar';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useT } from '@/components/ui/use-t';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import { authClient } from '@/components/site/account/auth-client';
import CameraVision from './camera-vision';
import { admitRoadCondition, parseRoadCondition, roadConditionLine } from '@/lib/feeds/cameras/road-condition';

interface CameraViewerProps {
  camera: any | null;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
  /** Inside a window on the map, which places it and answers Escape. */
  windowed?: boolean;
  /** False while other windows hold the playing slots: no stream, a Play button instead. */
  playing?: boolean;
  onPlay?: () => void;
}

export default function CameraViewer({ camera, onClose, onLocate, windowed = false, playing = true, onPlay }: CameraViewerProps) {
  const t = useT();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [deadStream, setDeadStream] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEscape(onClose, !!camera && !windowed);
  const isMobile = useIsMobile();
  const bar = useBottomBar(isMobile);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const externalFeedUrl = camera?.external_url || camera?.feed_url;
  // Re-checked here: the catalogue can be half an hour older than the reading's 2 h limit.
  const road = admitRoadCondition(parseRoadCondition(camera?.road));
  const hostedOffPlatform = isHostedOffPlatform(camera);

  /**
   * A SkylineWebcams page is usually a wrapper around a public YouTube
   * livestream published by the camera's actual operator, so it can play here
   * rather than sending the viewer off-platform. Resolved live rather than
   * baked into the camera data: a livestream that restarts comes back under a
   * new video id, and a baked id would work until it silently didn't.
   *
   * The answer is stored against the URL it belongs to. Keying it that way is
   * what makes switching cameras safe: a reply that arrives late carries the
   * previous key, so it is simply not read rather than painting the last
   * camera's stream into the current one. It also means neither `resolving`
   * nor the reset needs to be written back into state — both fall out of the
   * key comparison at render.
   */
  // A link that already names the video needs no lookup at all.
  const directEmbed = localEmbed(camera);
  // Snapshot cameras are checked too, in the background: the picture shows
  // immediately and is withdrawn only if the source says the camera is gone.
  const resolveKey: string | null =
    (needsResolution(camera) ? camera.external_url : null) ?? withdrawalCheck(camera);
  const [resolution, setResolution] = useState<{ key: string; embed: string | null; offline: boolean; kind?: string } | null>(null);
  const resolvedEmbed = directEmbed ?? (resolution && resolution.key === resolveKey ? resolution.embed : null);
  const resolving = Boolean(resolveKey) && resolution?.key !== resolveKey;
  const offline = camera?.offline === true || (resolution?.key === resolveKey && resolution.offline);
  const gone = resolution?.key === resolveKey && resolution.kind === 'missing';

  // Live video exists at the source but cannot be replayed here, so offer the
  // way through to it and stop calling the still image a live feed.
  const watchLiveUrl = liveFeedAtSource(camera);

  useEffect(() => {
    if (!resolveKey) return;
    let live = true;
    fetch(`/api/cctv/resolve?url=${encodeURIComponent(resolveKey)}`)
      .then(r => r.json())
      .then(d => { if (live) setResolution({ key: resolveKey, embed: d?.embeddable ? d.embedUrl : null, offline: d?.kind === 'offline' || d?.kind === 'missing', kind: d?.kind }); })
      // A resolver failure is not a broken camera — it falls back to the link.
      .catch(() => { if (live) setResolution({ key: resolveKey, embed: null, offline: false }); });
    return () => { live = false; };
  }, [resolveKey]);

  const declaredType = resolvedEmbed ? 'iframe' : (camera?.stream_type || 'jpg');
  // A stream that won't play falls back to the camera's still, when it has one.
  const streamType = declaredType === 'hls' && camera?.feed_url && deadStream === camera.stream_url ? 'jpg' : declaredType;
  const streamUrl: string | undefined = resolvedEmbed || camera?.stream_url;
  const view = offPlatformView({ hostedOffPlatform, resolving, resolvedEmbed, offline });
  const externalOnly = view !== 'inline';

  useEffect(() => {
    if (!camera) return;
    setLoading(true);
    setError(false);
    setImageUrl(null);

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!playing) {
      setLoading(false);
      return;
    }

    if (externalOnly) {
      setLoading(false);
      return;
    }

    if (streamType === 'hls' && camera.stream_url) {
      const stream = camera.stream_url;
      const failed = () => (camera.feed_url ? setDeadStream(stream) : setError(true));
      let live = true;
      // Fetched when a stream plays, not with the map: hls.js is 150 KB gzipped.
      void import('hls.js').then(({ default: Hls }) => {
        const video = videoRef.current;
        if (!live || !video) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: false });
          hlsRef.current = hls;
          hls.loadSource(stream);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setLoading(false);
            videoRef.current?.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) failed();
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = stream;
          video.addEventListener('error', failed, { once: true });
          video.addEventListener('loadedmetadata', () => {
            setLoading(false);
            videoRef.current?.play().catch(() => {});
          });
        }
      }, failed);
      return () => { live = false; };
    }

    if (streamType === 'mjpeg' && camera.stream_url) {
      setLoading(false);
      return;
    }

    if ((streamType === 'iframe' || streamType === 'mp4') && streamUrl) {
      setLoading(false);
      return;
    }

    // JPG fallback
    const targetUrl = camera.feed_url || camera.stream_url;
    if (targetUrl) {
      const url = targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`;
      setImageUrl(url);
    } else {
      setError(true);
      setLoading(false);
    }
  }, [camera, streamType, streamUrl, externalOnly, retryCount, playing]);

  // Auto-refresh for JPGs
  useEffect(() => {
    if (!playing || streamType !== 'jpg' || (!camera?.feed_url && !camera?.stream_url)) return;
    const targetUrl = camera.feed_url || camera.stream_url;
    if (!targetUrl) return;

    const iv = setInterval(() => {
      const url = targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`;
      setImageUrl(url);
    }, 5000); // 5s refresh for JPG
    return () => clearInterval(iv);
  }, [camera, streamType, playing]);

  // The detector reads a stream camera's frames from the <video> playing it.
  const cameraId: string | undefined = camera?.id;
  useEffect(() => {
    if (!cameraId || streamType !== 'hls') return;
    registerVideo(cameraId, videoRef.current);
    return () => registerVideo(cameraId, null);
    // A retry after an error mounts a new <video>: register that one.
  }, [cameraId, streamType, error, retryCount]);

  // A look belongs to the camera on screen: switching cameras or closing the viewer ends it.
  const lookedAt = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lookedAt.current && lookedAt.current !== cameraId) clearLook(lookedAt.current);
    lookedAt.current = cameraId;
  }, [cameraId]);

  const refresh = () => {
    const targetUrl = camera?.feed_url || camera?.stream_url;
    if (targetUrl) setImageUrl(targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`);
  };

  if (!camera) return null;

  const still = !!watchLiveUrl || streamType === 'jpg';
  const status = view === 'offline' ? (gone ? t('Removed by the publisher') : t('Off air at the source'))
    : view === 'external' ? t('Plays on the publisher’s site')
    : watchLiveUrl ? t('Still image here · live video at the source')
    : streamType === 'jpg' ? t('Still image · refreshes every 5 s')
    : t('Live video');
  // A withdrawn camera's page is a 404, so it gets no link.
  const sourceHref: string | undefined = gone ? undefined
    : camera.external_url || camera.feed_url || (streamType === 'iframe' ? camera.stream_url : undefined);
  const fit = fullscreen ? 'object-contain' : 'object-cover';

  return (
    <div
      role="dialog"
      aria-label={t('Camera: {name}', { name: camera.name })}
      className={cx(
        'flex flex-col overflow-hidden border-line bg-surface-1 shadow-float',
        windowed ? 'rounded-float border' : cx('fixed z-[500]', ENTER),
        windowed ? '' : fullscreen ? 'inset-2 rounded-float border md:inset-4'
          // A phone gets a full-width sheet on its bottom bar.
          : isMobile ? 'inset-x-0 rounded-t-float border-t'
          // Left of the control cluster and above its scale bar; --shell-bottom lifts it over a timeline.
          : 'right-[62px] bottom-[calc(var(--shell-bottom,28px)_+_52px)] w-[440px] rounded-float border',
      )}
      style={isMobile && !fullscreen && !windowed ? { bottom: bar } : undefined}
    >
      <header className="flex items-center gap-1 py-2 pr-2 pl-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px]/[18px] font-medium text-ink-1" title={camera.name}>{camera.name}</h3>
          <p className="truncate text-[11px]/[14px] text-ink-3">{status}</p>
        </div>
        {streamType === 'jpg' && !externalOnly && <IconButton label={t('Refresh the picture')} icon={RefreshCw} size="sm" onClick={refresh} />}
        {onLocate && Number.isFinite(camera.lat) && Number.isFinite(camera.lng) && (
          <IconButton label={t('Show on the map')} icon={MapPin} size="sm" onClick={() => onLocate(camera.lat, camera.lng)} />
        )}
        {sourceHref && <IconButton label={t('Open at the source')} icon={ExternalLink} size="sm" onClick={() => window.open(sourceHref, '_blank', 'noopener,noreferrer')} />}
        {windowed ? <><WindowSizeButton size="sm" /><WindowFoldButton size="sm" /></> : (
          <IconButton label={fullscreen ? t('Exit full screen') : t('Full screen')} icon={fullscreen ? Minimize2 : Maximize2} size="sm" className="hidden md:inline-flex" onClick={() => setFullscreen(f => !f)} />
        )}
        <IconButton label={t('Close')} kbd="Esc" icon={X} size={isMobile ? 'md' : 'sm'} onClick={onClose} tooltipSide="left" className={isMobile ? 'size-11!' : undefined} />
      </header>

      <div className={cx('relative bg-black', fullscreen ? 'min-h-0 flex-1' : 'aspect-video')}>
        {playing && loading && !error && !externalOnly && (
          <Overlay><Spinner /><p className="text-[12px] text-ink-2">{t('Loading the picture…')}</p></Overlay>
        )}

        {!playing ? (
          <Overlay>
            <p className="text-[12px] text-ink-2">{t('Paused while other pictures play')}</p>
            <Button size="sm" icon={PlayCircle} onClick={onPlay}>{t('Play')}</Button>
          </Overlay>
        ) : view === 'resolving' ? (
          <Overlay><Spinner /><p className="text-[12px] text-ink-2">{t('Finding a direct feed…')}</p></Overlay>
        ) : view === 'offline' && gone ? (
          <Overlay>
            <CameraOff aria-hidden className="size-5 text-ink-3" strokeWidth={1.75} />
            <p className="text-[13px] font-medium text-ink-1">{t('This camera has been removed')}</p>
            <p className="text-[12px] text-ink-3">{t('The publisher no longer lists it.')}</p>
          </Overlay>
        ) : view === 'offline' ? (
          <SignInOverlay>{t('The publisher has the feed switched off right now.')}</SignInOverlay>
        ) : view === 'external' ? (
          <Overlay>
            <p className="text-[13px] font-medium text-ink-1">{t('This feed only plays on the publisher’s site')}</p>
            {externalFeedUrl && (
              <Button size="sm" icon={ExternalLink} onClick={() => window.open(externalFeedUrl, '_blank', 'noopener,noreferrer')}>{t('Open the feed')}</Button>
            )}
          </Overlay>
        ) : error ? (
          <SignInOverlay action={<Button size="sm" icon={RefreshCw} onClick={() => { setError(false); setRetryCount(c => c + 1); }}>{t('Try again')}</Button>}>
            {t('The camera may be offline or restricted.')}
          </SignInOverlay>
        ) : streamType === 'hls' ? (
          <video ref={videoRef} className={cx('h-full w-full', fit)} autoPlay muted playsInline />
        ) : streamType === 'mjpeg' && camera.stream_url ? (
          <img src={camera.stream_url} alt={camera.name} className={cx('h-full w-full', fit)}
            onLoad={() => setLoading(false)} onError={() => { setLoading(false); setError(true); }} />
        ) : streamType === 'mp4' && camera.stream_url ? (
          <video src={camera.stream_url} className={cx('h-full w-full', fit)} autoPlay muted playsInline loop />
        ) : streamType === 'iframe' && streamUrl ? (
          <iframe src={streamUrl} title={camera.name} className="h-full w-full border-0" allow="autoplay; fullscreen" allowFullScreen />
        ) : imageUrl ? (
          <img src={imageUrl} alt={camera.name} className={cx('h-full w-full', fit)}
            onLoad={() => setLoading(false)} onError={() => { setLoading(false); setError(true); }} />
        ) : null}

        {/* Built-in analysis: counted on the reader's device, and what TI sees. */}
        <CameraVision camera={camera} fit={fullscreen ? 'contain' : 'cover'} ready={playing && !loading && !error && !externalOnly} />

        {playing && !error && !loading && !externalOnly && (
          <span className="absolute top-2 left-2 z-20 inline-flex h-5 items-center gap-1.5 rounded-[4px] bg-black/70 px-1.5 text-[11px] font-medium text-ink-1">
            <Dot tone={still ? 'neutral' : 'green'} pulse={!still} />
            {still ? t('Still') : t('Live')}
          </span>
        )}

        {/* Live video is on the operator's own page; this is the way to it. */}
        {watchLiveUrl && !error && !externalOnly && (
          <Button size="sm" icon={PlayCircle} className="absolute right-2 bottom-2 z-30"
            onClick={() => window.open(watchLiveUrl, '_blank', 'noopener,noreferrer')}>
            {t('Watch live at the source')}
          </Button>
        )}
      </div>

      {road && (
        <p className="border-t border-line px-3 py-2 text-[11px]/[14px] text-ink-2" title={road.station ? t('Measured at {station} ({source}), not read from the picture', { station: road.station, source: road.source }) : t('Measured at the paired station ({source}), not read from the picture', { source: road.source })}>
          {roadConditionLine(road, undefined, t)}
        </p>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-surface-0/95 p-4 text-center">{children}</div>;
}

// A deliberate joke: no plan fixes a dead camera, so the second line gives the real reason.
function SignInOverlay({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const t = useT();
  const signedIn = Boolean(authClient.useSession().data);
  return (
    <Overlay>
      <p className="text-[13px] font-medium text-ink-1">{t('Please sign in or upgrade your account to view (faster)!')}</p>
      <p className="text-[12px] text-ink-3">{children}</p>
      {(!signedIn || action) && (
        <div className="flex gap-2">
          {!signedIn && (
            <Button size="sm" variant="primary" icon={LogIn} onClick={() => showAccountDialog({ kind: 'sign-in', notice: t('It won’t bring that camera back, but it saves your areas, keys and workspaces.') })}>{t('Sign in')}</Button>
          )}
          {action}
        </div>
      )}
    </Overlay>
  );
}

function Spinner() {
  return <LoaderCircle aria-hidden className="size-5 animate-spin text-ink-3 motion-reduce:animate-none" strokeWidth={1.75} />;
}
