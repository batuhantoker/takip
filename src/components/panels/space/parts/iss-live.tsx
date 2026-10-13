'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Dot } from '@/components/ui/tag';
import { useEscape } from '@/components/ui/use-escape';
import { ISS_ALT_KM, ISS_FEEDS, ISS_ORBIT_MIN, issEmbedSrc, type IssFeed } from './iss-feeds';

const ALLOW = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';

function Player({ feed, big }: { feed: IssFeed; big?: boolean }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-card border border-line bg-surface-0">
      <iframe key={feed.videoId} src={issEmbedSrc(feed.videoId, !!big)} title={`ISS live: ${feed.label}`} allow={ALLOW} allowFullScreen
        className="absolute inset-0 size-full border-0" />
    </div>
  );
}

function Caption({ feed }: { feed: IssFeed }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-body font-medium text-ink-1"><Dot tone="green" pulse label="Live" />{feed.detail}</p>
      <p className="mt-0.5 text-meta text-ink-3">
        About {ISS_ALT_KM} km up, once round the Earth every {ISS_ORBIT_MIN} minutes
      </p>
    </div>
  );
}

/** A large player over everything: YouTube only sends HD to a player this size. */
function Theatre({ feed, setFeed, onClose }: { feed: IssFeed; setFeed: (f: IssFeed) => void; onClose: () => void }) {
  useEscape(onClose);
  return createPortal(
    <div role="dialog" aria-label="ISS live, large player" className="fixed inset-0 z-[9000] flex items-center justify-center bg-surface-0/95 p-4 md:p-8" onClick={onClose}>
      <div className="flex w-full max-w-[1600px] flex-col gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Caption feed={feed} />
          <IconButton className="ml-auto" label="Close" kbd="Esc" icon={X} onClick={onClose} />
        </div>
        <div className="mx-auto w-full" style={{ maxWidth: 'calc(82vh * 16 / 9)' }}><Player feed={feed} big /></div>
        <Segmented label="Camera" value={feed.id} onChange={id => setFeed(ISS_FEEDS.find(f => f.id === id)!)}
          options={ISS_FEEDS.map(f => ({ value: f.id, label: f.label }))} />
      </div>
    </div>,
    document.body,
  );
}

/** The space station's outside cameras, live. */
export default function IssLive() {
  const [feed, setFeed] = useState(ISS_FEEDS[0]);
  const [big, setBig] = useState(false);
  return (
    <div className="flex flex-col gap-3 p-4">
      <Player feed={feed} />
      <Segmented label="Camera" value={feed.id} onChange={id => setFeed(ISS_FEEDS.find(f => f.id === id)!)} full size="sm"
        options={ISS_FEEDS.map(f => ({ value: f.id, label: f.label }))} />
      <Caption feed={feed} />
      <div className="flex items-center gap-2">
        <Button size="sm" icon={Maximize2} onClick={() => setBig(true)} title="YouTube only sends HD to a large player">Watch larger</Button>
        <a href={`https://www.youtube.com/watch?v=${feed.videoId}`} target="_blank" rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-meta text-ink-3 hover:text-ink-1">
          YouTube <ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
        </a>
      </div>
      {big && <Theatre feed={feed} setFeed={setFeed} onClose={() => setBig(false)} />}
    </div>
  );
}
