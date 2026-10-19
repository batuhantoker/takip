'use client';

import type { Dispatch, SetStateAction } from 'react';
import { ExternalLink, PlayCircle, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, ENTER } from '@/components/ui/class-names';
import { FloatingWindow, playingIds, useWindows, WindowFoldButton, WindowSizeButton, windowStore } from '@/components/map/windows';
import { Dot } from '@/components/ui/tag';
import { useEscape } from '@/components/ui/use-escape';
import { useBottomBar } from '@/components/shell/mobile/use-bottom-bar';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useT } from '@/components/ui/use-t';

/** Extracts a watchable YouTube URL from embed/channel URLs */
function getYouTubeWatchUrl(url: string): string {
  if (url.includes('channel=')) return `https://www.youtube.com/channel/${url.split('channel=')[1].split('&')[0]}/live`;
  if (url.includes('/embed/')) return `https://www.youtube.com/watch?v=${url.split('/embed/')[1].split('?')[0]}`;
  return url;
}

const ID = 'live';

/** A live news channel: a window on the map, or the bottom-bar player on a phone. */
export default function LiveFeedModal({ liveFeedUrl, liveFeedName, liveFeedEmbedAllowed, setLiveFeedUrl }: {
  liveFeedUrl: string | null;
  liveFeedName: string;
  liveFeedEmbedAllowed: boolean;
  setLiveFeedUrl: Dispatch<SetStateAction<string | null>>;
}) {
  const t = useT();
  const isMobile = useIsMobile();
  const bar = useBottomBar(isMobile);
  const { list } = useWindows();
  const close = () => setLiveFeedUrl(null);
  useEscape(close, !!liveFeedUrl && isMobile);
  if (!liveFeedUrl) return null;

  const player = (
    <LivePlayer url={liveFeedUrl} name={liveFeedName} embed={liveFeedEmbedAllowed} onClose={close}
      playing={isMobile || playingIds(list).has(ID)} windowed={!isMobile} />
  );
  if (isMobile) {
    return <div className={cx('fixed inset-x-0 z-[500]', ENTER)} style={{ bottom: bar }}>{player}</div>;
  }
  return <FloatingWindow id={ID} kind="live" label={t('Live: {name}', { name: liveFeedName })} onClose={close}>{player}</FloatingWindow>;
}

function LivePlayer({ url, name, embed, onClose, playing, windowed }: {
  url: string;
  name: string;
  embed: boolean;
  onClose: () => void;
  playing: boolean;
  windowed: boolean;
}) {
  const t = useT();
  const watch = getYouTubeWatchUrl(url);
  return (
    <section aria-label={t('Live: {name}', { name })}
      className={cx('flex flex-col overflow-hidden border-line bg-surface-1 shadow-float', windowed ? 'rounded-float border' : 'rounded-t-float border-t')}>
      <header className="flex items-center gap-1 py-2 pr-2 pl-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 truncate text-[13px]/[18px] font-medium text-ink-1" title={name}>
            <Dot tone="red" pulse={playing && embed} />
            <span className="truncate">{name}</span>
          </h3>
          <p className="truncate text-[11px]/[14px] text-ink-3">{embed ? t('Live stream') : t('Plays on YouTube only')}</p>
        </div>
        <IconButton label={t('Open on YouTube')} icon={ExternalLink} size="sm" onClick={() => window.open(watch, '_blank', 'noopener,noreferrer')} />
        {windowed && <><WindowSizeButton size="sm" /><WindowFoldButton size="sm" /></>}
        <IconButton label={t('Close')} kbd="Esc" icon={X} size={windowed ? 'sm' : 'md'} onClick={onClose} tooltipSide="left" className={windowed ? undefined : 'size-11!'} />
      </header>
      <div className="relative aspect-video bg-black">
        {!embed ? (
          <Overlay>
            <p className="text-[13px] font-medium text-ink-1">{t('{name} does not allow playing here', { name })}</p>
            <Button size="sm" icon={ExternalLink} onClick={() => window.open(watch, '_blank', 'noopener,noreferrer')}>{t('Watch on YouTube')}</Button>
          </Overlay>
        ) : !playing ? (
          <Overlay>
            <p className="text-[12px] text-ink-2">{t('Paused while other pictures play')}</p>
            <Button size="sm" icon={PlayCircle} onClick={() => windowStore.focus(ID)}>{t('Play')}</Button>
          </Overlay>
        ) : (
          <iframe src={url} title={name} className="absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media" allowFullScreen />
        )}
      </div>
      {embed && (
        <p className="border-t border-line px-3 py-2 text-[11px]/[14px] text-ink-3">
          {t('If it says the video is unavailable, open it on YouTube.')}
        </p>
      )}
    </section>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-0/95 p-4 text-center">{children}</div>;
}
