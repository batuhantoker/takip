import { ArrowRight } from 'lucide-react';
import type { Attention, AttentionTone } from '../lib/attention';

const DOT: Record<AttentionTone, string> = { problem: 'bg-red', watch: 'bg-amber', news: 'bg-ink-4' };
const TAB: Record<Attention['tab'], string> = {
  audience: 'Audience', visitors: 'Visitors', engagement: 'Engagement', api: 'API', data: 'Data & storage', system: 'System',
};

/** The Overview's first card: what needs a look, then what's worth knowing, each linking to its tab. */
export function AttentionList({ items, loading }: { items: Attention[]; loading: boolean }) {
  const issues = items.filter(i => i.tone !== 'news');
  const news = items.filter(i => i.tone === 'news');
  return (
    <section aria-label="Needs a look" className="rounded-card border border-line bg-surface-1 px-4 py-3">
      {issues.length ? (
        <>
          <h2 className="text-[12px] font-medium text-ink-1">Needs a look</h2>
          <Rows items={issues} />
        </>
      ) : (
        <p className="flex items-center gap-2 text-[12px] text-ink-2">
          <span aria-hidden className={`size-1.5 rounded-full ${loading ? 'bg-ink-4' : 'bg-green'}`} />
          {loading ? 'Checking jobs, errors, backups, disk and feeds…' : 'Nothing needs a look: no failed jobs, server errors, refusals, open reports, missed backups or failing feeds.'}
        </p>
      )}
      {news.length > 0 && (
        <>
          <h2 className="mt-3 text-[12px] font-medium text-ink-1">Worth knowing</h2>
          <Rows items={news} />
        </>
      )}
    </section>
  );
}

function Rows({ items }: { items: Attention[] }) {
  return (
    <ul className="mt-1.5 flex flex-col">
      {items.map(i => (
        <li key={i.id}>
          <a href={`#${i.tab}`} className="group flex items-center gap-2 rounded-control py-1 text-[12px] text-ink-2 hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-accent">
            <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT[i.tone]}`} />
            <span className="min-w-0 flex-1 truncate">{i.text}</span>
            <span className="flex shrink-0 items-center gap-1 text-ink-4 group-hover:text-ink-2">{TAB[i.tab]}<ArrowRight aria-hidden className="size-3" /></span>
          </a>
        </li>
      ))}
    </ul>
  );
}
