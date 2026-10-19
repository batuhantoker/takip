'use client';

import { useEffect, useState } from 'react';
import { MapPin, Newspaper } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx, TRANSITION } from '@/components/ui/class-names';
import { EmptyState } from '@/components/ui/empty-state';
import { Dot, type DotTone } from '@/components/ui/tag';
import { Figure } from '@/components/ui/figure';
import { useT } from '@/components/ui/use-t';
import { placeName, stamp } from './format';
import { openLink } from '@/components/panels/alerts/rows/row-parts';

/** The headlines on a phone: newest first, a tap opens the story, the pin goes to the place it names. */

interface IntelFeedProps {
  data: { news?: unknown[] };
  onLocate?: (lat: number, lng: number) => void;
}

type Story = { title: string; source: string; link: string | null; ts: number; coords: [number, number] | null; anchor: string | null; score: number };

function toStory(raw: unknown): Story | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title : null;
  const ts = typeof r.published === 'string' ? Date.parse(r.published) : NaN;
  if (!title || !Number.isFinite(ts)) return null;
  const c = r.coords;
  return {
    title,
    source: typeof r.source_name === 'string' ? r.source_name : typeof r.source === 'string' ? r.source : '',
    link: typeof r.link === 'string' && /^https?:\/\//.test(r.link) ? r.link : null,
    ts,
    coords: Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number' ? [c[0], c[1]] : null,
    anchor: typeof r.coords_anchor === 'string' ? r.coords_anchor : null,
    score: typeof r.risk_score === 'number' ? r.risk_score : 0,
  };
}

// The score counts conflict keywords; it is a word match, so it only ever tints the dot.
const toneFor = (score: number): DotTone => (score >= 8 ? 'red' : score >= 6 ? 'amber' : 'muted');

export default function IntelFeed({ data, onLocate }: IntelFeedProps) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const stories = (data.news ?? []).map(toStory).filter((s): s is Story => s !== null).sort((a, b) => b.ts - a.ts).slice(0, 40);

  if (!stories.length) {
    return <EmptyState icon={Newspaper} title={t('No headlines yet')} body={t('They arrive within a minute of opening TAKIP.')} />;
  }

  return (
    <section aria-label={t('Headlines')}>
      <ul className="flex flex-col">
        {stories.map((s, i) => (
          <li key={`${s.ts}-${i}`} className={cx('relative -mx-2 flex gap-3 rounded-control px-2 py-2.5 active:bg-surface-2', TRANSITION)}>
            <span className="flex h-[18px] w-4 shrink-0 items-center justify-center"><Dot tone={toneFor(s.score)} /></span>
            <button type="button" disabled={!s.link} onClick={() => s.link && openLink(s.link)}
              className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-accent">
              <span className="line-clamp-2 text-body font-medium text-ink-1">{s.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-small text-ink-3">
                <span className="truncate text-ink-2">{s.source}</span>
                <span aria-hidden className="text-ink-4">·</span>
                <Figure className="shrink-0 text-meta">{stamp(s.ts, now, t)}</Figure>
              </span>
            </button>
            {s.coords && onLocate && (
              <span className="relative z-[1] shrink-0">
                <IconButton size="sm" icon={MapPin} label={s.anchor ? t('Show {place} on the map', { place: placeName(s.anchor) }) : t('Show on the map')}
                  onClick={() => onLocate(s.coords![0], s.coords![1])} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
