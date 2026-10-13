'use client';

import { useMemo, useState } from 'react';
import { CornerDownRight, ExternalLink, Image as ImageIcon, MapPin, Play, Video } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Tag } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { BLOCS } from '@/lib/alerts/digest';
import type { AlertItem, LocateOptions, NewsAlert } from '@/lib/alerts/live-alerts';
import { htmlToText } from '@/lib/telegram';
import { AlertRow, Meta } from './alert-row';
import { compact, placeName, plural, toneLabel, toneOf } from '@/components/panels/alerts/format';
import { Carriers, openLink } from './row-parts';

export const newsTarget = (n: NewsAlert): [number, number, LocateOptions] | null =>
  n.coords && n.place ? [n.coords[0], n.coords[1], { zoom: n.place.precision === 'settlement' ? 10 : 7, alertId: n.id }] : null;

export default function NewsRow({ item, similar, now, selected, onSelect, onLocate }: {
  item: NewsAlert;
  similar: AlertItem[];
  now: number;
  selected: boolean;
  onSelect: () => void;
  onLocate: (lat: number, lng: number, options?: LocateOptions) => void;
}) {
  const target = newsTarget(item);
  const where = item.place?.name ?? (item.anchor ? placeName(item.anchor) : null);
  const MediaIcon = item.media?.kind === 'video' ? Video : ImageIcon;
  const copies = similar.filter((s): s is NewsAlert => s.kind === 'news');
  const elsewhere = new Set([...item.carriers.map(c => c.source), ...copies.map(c => c.source)].filter(s => s !== item.source)).size;

  return (
    <AlertRow
      tone={toneOf(item)}
      toneLabel={toneLabel(item)}
      title={item.title}
      ts={item.ts}
      now={now}
      selected={selected}
      onSelect={onSelect}
      meta={<>
        {item.flag && <Tag tone="red">Breaking</Tag>}
        <Meta parts={[
          item.source_name,
          where,
          elsewhere > 0 && `also on ${plural(elsewhere, 'channel')}`,
        ]} />
        {item.media && <MediaIcon aria-label={item.media.kind === 'video' ? 'Has video' : 'Has a photo'} className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.75} />}
      </>}
      actions={<>
        {target && <IconButton size="sm" label={`Show ${item.place!.name} on the map`} icon={MapPin} onClick={() => onLocate(...target)} />}
        {item.link && <IconButton size="sm" label="Open the post" icon={ExternalLink} onClick={() => openLink(item.link!)} />}
      </>}
    >
      <NewsDetail item={item} similar={similar} now={now} onLocate={onLocate} />
    </AlertRow>
  );
}

function NewsDetail({ item, similar, now, onLocate }: {
  item: NewsAlert; similar: AlertItem[]; now: number; onLocate: (lat: number, lng: number, options?: LocateOptions) => void;
}) {
  const [full, setFull] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const target = newsTarget(item);
  const video = item.media?.video && !mediaFailed ? item.media.video : null;
  const thumb = !video && item.media?.thumb && !mediaFailed ? item.media.thumb : null;
  // Some wires send the description as HTML, often nothing but an image tag.
  const summary = useMemo(() => {
    const text = htmlToText(item.summary);
    return text === item.title.trim() ? '' : text;
  }, [item.summary, item.title]);
  const long = summary.length > 420;
  const provenance = [
    item.bloc ? `${BLOCS[item.bloc].label} channel` : item.lean,
    item.views != null ? `${compact(item.views)} ${item.views === 1 ? 'view' : 'views'}` : null,
  ].filter(Boolean).join(' · ');
  const copies = similar.filter((s): s is NewsAlert => s.kind === 'news');

  return (
    <div className="flex flex-col gap-3">
      {video && (
        <video src={video} poster={item.media?.thumb ?? undefined} controls playsInline preload="none" onError={() => setMediaFailed(true)}
          className="block max-h-64 w-full rounded-card border border-line bg-surface-0" />
      )}
      {thumb && (
        <a href={item.link ?? undefined} target="_blank" rel="noopener noreferrer" className="relative block overflow-hidden rounded-card border border-line bg-surface-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote CDN preview, loaded only when opened */}
          <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setMediaFailed(true)} className="max-h-52 w-full object-cover" />
          {item.media?.kind === 'video' && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-control bg-surface-1 px-2 py-1 text-small text-ink-1">
              <Play aria-hidden className="size-3.5" strokeWidth={1.75} /> Watch on Telegram{item.media.duration ? ` · ${item.media.duration}` : ''}
            </span>
          )}
        </a>
      )}

      {summary && (
        <div>
          <p className={cx('text-small break-words whitespace-pre-line text-ink-2', long && !full && 'line-clamp-6')}>{summary}</p>
          {long && (
            <button type="button" onClick={() => setFull(f => !f)} className={cx('mt-1 rounded-control text-small text-accent hover:underline', FOCUS_RING)}>
              {full ? 'Show less' : 'Read all'}
            </button>
          )}
        </div>
      )}

      {item.forwarded_from && (
        <p className="text-small text-ink-3">
          Forwarded from{' '}
          {item.forwarded_from.url
            ? <a href={item.forwarded_from.url} target="_blank" rel="noopener noreferrer" className="text-ink-2 hover:text-accent">{item.forwarded_from.name}</a>
            : <span className="text-ink-2">{item.forwarded_from.name}</span>}
        </p>
      )}

      {provenance && <p className="text-meta text-ink-3">{provenance}</p>}

      <div className="flex flex-wrap gap-2">
        {target && <Button size="sm" icon={MapPin} onClick={() => onLocate(...target)}>Show {item.place!.name}</Button>}
        {item.link && <Button size="sm" variant={target ? 'ghost' : 'secondary'} icon={ExternalLink} onClick={() => openLink(item.link!)}>Open post</Button>}
        {!target && item.coords && (
          <Tooltip label="The post names no town, so this is the middle of the country it mentions">
            <Button size="sm" variant="ghost" icon={MapPin} className={item.link ? undefined : '-ml-2'} onClick={() => onLocate(item.coords![0], item.coords![1])}>
              Roughly {item.anchor ? placeName(item.anchor) : 'here'}
            </Button>
          </Tooltip>
        )}
        {item.reply_to && <Button size="sm" variant="ghost" icon={CornerDownRight} onClick={() => openLink(item.reply_to!)}>In reply to</Button>}
      </div>

      <Carriers title="Also carried by" now={now} rows={item.carriers.map(c => ({ key: c.source, name: c.source_name, note: c.lean, ts: c.published, link: c.link }))} />
      <Carriers title="Same headline from" now={now} rows={copies.map(c => ({ key: c.id, name: c.source_name, note: c.lean, ts: c.ts, link: c.link }))} />
    </div>
  );
}
