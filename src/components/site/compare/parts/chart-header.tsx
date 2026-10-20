import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { LINK_BUTTON } from '@/components/site/pages/site-frame';

/** The top of a comparison or a measure's world page: where it belongs, the heading, the lede, the map button and the chart. */
export function ChartHeader({ kicker, heading, lede, points, open, openLabel, hero }: {
  kicker: { href: string; label: string };
  heading: string;
  lede: string;
  /** Short facts under the lede, each led by what it is about. */
  points?: { metric: string; line: string }[];
  open?: string;
  openLabel: string;
  hero: ReactNode;
}) {
  return (
    <header className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div>
        <Link href={kicker.href} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>{kicker.label}</Link>
        <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{heading}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{lede}</p>
        {points && points.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2.5">
            {points.map(p => (
              <li key={p.metric} className="flex gap-2.5 text-[15px] leading-snug text-ink-2">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink-3" />
                <span><span className="font-medium text-ink-1">{p.metric}</span> · {p.line}</span>
              </li>
            ))}
          </ul>
        )}
        {open && (
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{openLabel}<ArrowUpRight className="size-4" aria-hidden /></a>
          </div>
        )}
      </div>
      {hero}
    </header>
  );
}
