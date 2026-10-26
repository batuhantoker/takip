import { ArrowRight } from 'lucide-react';
import type { Finding, FindingTarget } from '../lib/engagement-findings';

const CARD: Record<FindingTarget, string> = {
  'engagement-funnel': 'Funnel',
  'engagement-stay': 'Time on the map',
  'engagement-entries': 'Where people came in',
  'engagement-use': 'What people use',
};

/** The Engagement tab's first card: the range's findings, most telling first, each a jump to the card behind it. */
export function EngagementFindings({ items, onGo }: { items: Finding[]; onGo: (finding: Finding) => void }) {
  return (
    <section aria-labelledby="engagement-findings" className="rounded-card border border-line bg-surface-1 px-4 py-3">
      <h2 id="engagement-findings" className="text-[12px] font-medium text-ink-1">What stands out</h2>
      <ul className="mt-1.5 flex flex-col">
        {items.map(f => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onGo(f)}
              className="group flex w-full items-baseline gap-3 rounded-control py-1.5 text-left text-[13px] focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="w-12 shrink-0 text-right font-mono font-medium tabular-nums text-ink-1">{f.value}</span>
              <span className="min-w-0 flex-1 text-ink-2 group-hover:text-ink-1">{f.text}</span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-4 group-hover:text-ink-2">
                <span className="hidden sm:inline">{CARD[f.target]}</span>
                <ArrowRight aria-hidden className="size-3" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
