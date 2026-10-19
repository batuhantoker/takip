'use client';

import { useId, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { cx, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { ArcGISResult } from '@/lib/map/layers/arcgis';

/** A word for the geometry when the title names it outright; ArcGIS search does not say, and tags guess wrong too often. */
function geometryWord(title: string): string | null {
  const lower = title.toLowerCase();
  if (/\b(polygons?|boundar(y|ies)|zones?|areas?|parcels?|districts?)\b/.test(lower)) return msg('Areas');
  if (/\b(lines?|routes?|pipelines?|roads?|rail|cables?|transmission)\b/.test(lower)) return msg('Lines');
  if (/\b(points?|locations?|sites?|stations?|shelters?|facilities)\b/.test(lower)) return msg('Points');
  return null;
}

// ArcGIS owners and many titles are account or file names ("Federal_User_Community"); spaces read better and stay recognisable.
const spaced = (s: string) => s.replace(/_+/g, ' ').trim();
export const layerTitle = spaced;

const views = (n: number, t: Translate) => t('{n, plural, one {{views} view} other {{views} views}}', {
  n, views: new Intl.NumberFormat(t.intl, { notation: 'compact', maximumFractionDigits: 1 }).format(n),
});

/** One search result. The row opens a short description; the trailing control adds it to the map on its own. */
export function ArcgisResultRow({ result, open, onToggle, trailing }: {
  result: ArcGISResult;
  open: boolean;
  onToggle: () => void;
  trailing: ReactNode;
}) {
  const t = useT();
  const id = useId();
  const title = spaced(result.title);
  const kind = geometryWord(title);
  return (
    <div className={cx('-mx-2 rounded-control', open ? 'bg-surface-2' : 'hover:bg-surface-2', TRANSITION)}>
      <div className="relative flex min-h-10 items-center gap-3 px-2 py-1.5">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}
          className="min-w-0 flex-1 cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent">
          <span className={cx('block text-body font-medium text-ink-1', !open && 'truncate')}>{title}</span>
          <span className="block truncate text-small text-ink-2">{[kind && t(kind), spaced(result.owner)].filter(Boolean).join(' · ')}</span>
        </button>
        <span className="relative z-[1] flex shrink-0 items-center">{trailing}</span>
      </div>
      {open && (
        <div id={id} className="px-2 pb-3">
          {result.snippet && <p className="line-clamp-5 text-small text-ink-2">{result.snippet}</p>}
          <p className="mt-1.5 flex items-center gap-1.5 text-meta text-ink-3">
            <span className="tabular-nums">{views(result.numViews ?? 0, t)}</span>
            <span aria-hidden>·</span>
            <a href={`https://www.arcgis.com/home/item.html?id=${encodeURIComponent(result.id)}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm text-ink-2 hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-accent">
              {t('Open on ArcGIS Online')}<ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
