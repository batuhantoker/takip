'use client';

import { useState } from 'react';
import { ExternalLink, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Figure } from '@/components/ui/figure';
import { fullDate, stamp } from '@/components/panels/alerts/format';

export const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

/** A turning loader that fits an IconButton's icon slot. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cx(className, 'animate-spin motion-reduce:animate-none')} strokeWidth={1.75} />;
}

const toMs = (ts: number | string | null) => (typeof ts === 'string' ? Date.parse(ts) : ts);

/** Who else carried a report: name, lean, when, and a link to their post. */
export function Carriers({ title, rows, now }: {
  title: string;
  rows: { key: string; name: string; note?: string | null; ts: number | string | null; link: string | null }[];
  now: number;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-1 text-meta font-medium text-ink-3">{title}</p>
      <ul className="flex flex-col">
        {rows.map(r => {
          const ms = toMs(r.ts);
          return (
            <li key={r.key} className="flex h-7 min-w-0 items-center gap-2 text-small">
              <span className="shrink-0 text-ink-1">{r.name}</span>
              {r.note && <span className="min-w-0 truncate text-ink-3">{r.note}</span>}
              <span className="ml-auto shrink-0 text-meta text-ink-3" title={ms ? fullDate(ms) : undefined}>
                {ms && Number.isFinite(ms) ? <Figure>{stamp(ms, now)}</Figure> : null}
              </span>
              {r.link && (
                <a href={r.link} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${r.name} post`}
                  className={cx('flex size-6 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-surface-3 hover:text-ink-1', FOCUS_RING)}>
                  <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SIMILAR_SHOWN = 6;

/** A tighter list of the near-copies folded under one alert, each one a target of its own. */
export function SimilarList({ title, rows }: {
  title: string;
  rows: { key: string; label: string; meta?: string | null; onClick?: () => void }[];
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, SIMILAR_SHOWN);
  return (
    <div>
      <p className="mb-1 text-meta font-medium text-ink-3">{title} · {rows.length.toLocaleString()}</p>
      <ul className="-mx-2 flex flex-col">
        {shown.map(r => (
          <li key={r.key}>
            <button type="button" onClick={r.onClick} disabled={!r.onClick}
              className={cx('flex min-h-7 w-full min-w-0 items-baseline gap-2 rounded-control px-2 py-1 text-left text-small enabled:hover:bg-surface-3', FOCUS_RING)}>
              <span className="line-clamp-2 min-w-0 flex-1 text-ink-2">{r.label}</span>
              {r.meta && <span className="shrink-0 text-meta text-ink-3">{r.meta}</span>}
            </button>
          </li>
        ))}
      </ul>
      {rows.length > SIMILAR_SHOWN && (
        <Button variant="ghost" size="sm" className="mt-1 -ml-2.5" onClick={() => setAll(a => !a)}>
          {all ? 'Show fewer' : `Show ${rows.length - SIMILAR_SHOWN} more`}
        </Button>
      )}
    </div>
  );
}
