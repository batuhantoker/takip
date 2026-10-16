'use client';

import { ExternalLink } from 'lucide-react';
import { Tag } from '@/components/ui/tag';
import { quoteOf, type NewsAlert } from '@/lib/intel/alerts/live-alerts';
import { AlertRow, Meta } from './alert-row';
import { Figure } from '@/components/ui/figure';
import { fullDate, stamp, toneOf } from '@/components/panels/alerts/format';
import { cx, FOCUS_RING } from '@/components/ui/class-names';

/** A run of quotes from one speaker on one channel, read as one statement. */
export default function StatementRow({ speaker, items, now, selected, onSelect }: {
  speaker: string;
  items: NewsAlert[];
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const lead = items[0];
  return (
    <AlertRow
      tone={toneOf(lead)}
      title={<>{speaker}: <span className="font-normal text-ink-2">{quoteOf(lead, speaker, false)}</span></>}
      ts={lead.ts}
      now={now}
      selected={selected}
      onSelect={onSelect}
      meta={<>
        {items.some(i => i.flag) && <Tag tone="red">Breaking</Tag>}
        <Meta parts={[lead.source_name, `${items.length} statements`]} />
      </>}
    >
      <ol className="flex flex-col gap-2.5 border-l border-line-strong pl-3">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-small whitespace-pre-line text-ink-2">{quoteOf(item, speaker, true)}</p>
            <span className="flex shrink-0 items-center gap-1">
              <time title={fullDate(item.ts)} className="text-meta text-ink-3"><Figure>{stamp(item.ts, now)}</Figure></time>
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" aria-label="Open this statement"
                  className={cx('flex size-6 items-center justify-center rounded-control text-ink-3 hover:bg-surface-3 hover:text-ink-1', FOCUS_RING)}>
                  <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                </a>
              )}
            </span>
          </li>
        ))}
      </ol>
    </AlertRow>
  );
}
