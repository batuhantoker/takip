'use client';

import { useState } from 'react';
import { ExternalLink, History, Navigation } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Panel } from '@/components/ui/panel';
import { Property, PropertyList } from '@/components/ui/property-list';
import { Tag } from '@/components/ui/tag';
import type { FleetPayload } from '@/lib/space/craft/fleet';
import type { SpaceSelection } from '@/lib/space/selection';
import type { SkyPayload } from '@/lib/space/sky';
import type { SurfacePayload } from '@/lib/space/bodies/surface';
import type { WikiSummary } from '@/lib/core/wikipedia/summary';
import { wikiTopic } from '@/lib/space/wiki-topic';
import { describeDeep } from '@/components/panels/space/view/lib/describe-deep';
import { describeNear } from '@/components/panels/space/view/lib/describe-near';
import { fieldLabel } from '@/components/panels/space/view/lib/field-label';
import { useWiki } from '@/components/panels/space/use-wiki';
import type { SpaceScene } from '@/lib/space/scene/space-scene';

/** The space view's inspect card: what the selected thing is, and where it is right now. */

const LINK = cx('inline-flex h-7 min-w-0 items-center gap-1.5 rounded-control px-2.5 text-small font-medium text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION);

/** Wikipedia's picture: it fades in once loaded, and a broken one leaves no empty frame behind. */
function WikiImage({ wiki, image }: { wiki: WikiSummary; image: NonNullable<WikiSummary['image']> }) {
  const [ok, setOk] = useState<boolean | null>(null);
  if (ok === false) return null;
  return (
    <a href={wiki.url} target="_blank" rel="noopener noreferrer" title={`${wiki.title} on Wikipedia`}
      className={cx('mb-4 block overflow-hidden rounded-card border border-line bg-surface-2', FOCUS_RING)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnails, sized by the API */}
      <img src={image.src} alt={wiki.title} loading="lazy" onLoad={() => setOk(true)} onError={() => setOk(false)}
        className={cx('h-[132px] w-full object-cover transition-opacity duration-150 ease-out motion-reduce:transition-none', ok ? 'opacity-100' : 'opacity-0')} />
    </a>
  );
}

export default function SpaceCard({ selection, now, sky, fleet, surfaces, scene, onClose, onFly, onReplay }: {
  selection: SpaceSelection;
  now: number;
  sky: SkyPayload | null;
  fleet: FleetPayload | null;
  surfaces: Record<'moon' | 'mars', SurfacePayload | null>;
  scene: SpaceScene | null;
  onClose: () => void;
  onFly: () => void;
  /** Plays back the craft's whole flight. */
  onReplay?: () => void;
}) {
  const card = describeNear(selection, now, sky, fleet, surfaces) ?? describeDeep(selection, scene, now);
  const wiki = useWiki(card ? wikiTopic(selection, card.title) : null);
  if (!card) return null;
  const footer = (onReplay || card.link) ? (
    <>
      {onReplay && <Button variant="primary" size="sm" icon={History} onClick={onReplay}>Watch the flight</Button>}
      {card.link && (
        <a href={card.link.href} target="_blank" rel="noopener noreferrer" className={cx(LINK, onReplay ? 'ml-auto' : '-ml-2.5')}>
          <span className="min-w-0 truncate">{card.link.label}</span>
          <ExternalLink aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
        </a>
      )}
    </>
  ) : undefined;

  return (
    // Escape belongs to the space view, which steps back from the card, then the replay, then space itself.
    <Panel docked={false} closeOnEscape={false} className="pointer-events-auto w-[320px] shrink-0" title={card.title} onClose={onClose}
      subtitle={(
        <span className="inline-flex max-w-full items-center gap-1.5">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: card.color }} />
          <span className="truncate">{card.subtitle}</span>
        </span>
      )}
      actions={<IconButton label="Fly here" icon={Navigation} onClick={onFly} />}
      footer={footer}>
      {wiki?.image && <WikiImage key={wiki.image.src} wiki={wiki} image={wiki.image} />}
      {card.illustration && <div className="mb-3"><Tag>Illustration</Tag></div>}
      {card.fields.length > 0 && (
        <PropertyList>
          {card.fields.map(([label, value]) => <Property key={label} label={fieldLabel(label)} value={value} />)}
        </PropertyList>
      )}
      {card.note && <p className="mt-3 text-small text-ink-2">{card.note}</p>}
      {card.source && <p className="mt-2 text-meta text-ink-3">{card.source}</p>}
      {wiki?.extract && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="line-clamp-4 text-small text-ink-2" title={wiki.extract}>{wiki.extract}</p>
          <a href={wiki.url} target="_blank" rel="noopener noreferrer" className={cx('mt-1.5 inline-flex items-center gap-1 rounded-[4px] text-meta text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            More on Wikipedia <ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
          </a>
        </div>
      )}
    </Panel>
  );
}
