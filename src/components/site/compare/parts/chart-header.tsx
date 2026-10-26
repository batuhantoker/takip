import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { LINK_BUTTON, TEXT_LINK } from '@/components/site/pages/site-frame';

/** The top of a comparison or a measure's world page: where it belongs, the heading, the lede, the map button and the chart. */
export function ChartHeader({ kicker, heading, lede, points, open, openLabel, hero, children }: {
  kicker: { href: string; label: string };
  heading: string;
  lede: string;
  /** Short facts under the lede, each led by what it is about, which links to its own page where given. */
  points?: { metric: string; line: string; href?: string }[];
  open?: string;
  openLabel: string;
  hero: ReactNode;
  /** Under the map button: where to go next. */
  children?: ReactNode;
}) {
  // On a phone where to go next follows the chart, so the chart is on the first screen; beside it, it stays under the text.
  return (
    <header className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-12 lg:gap-y-0">
      <div className={cx('lg:col-start-1 lg:row-start-1', children ? 'lg:self-end' : 'lg:self-center')}>
        <Link href={kicker.href} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>{kicker.label}</Link>
        <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{heading}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{lede}</p>
        {points && points.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2.5">
            {points.map(p => (
              <li key={p.metric} className="flex gap-2.5 text-[15px] leading-snug text-ink-2">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink-3" />
                <span>
                  {p.href
                    ? <Link href={p.href} className={cx(TEXT_LINK, 'font-medium')}>{p.metric}</Link>
                    : <span className="font-medium text-ink-1">{p.metric}</span>}
                  {' · '}{p.line}
                </span>
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
      <div className={cx('lg:col-start-2 lg:row-start-1 lg:self-center', !!children && 'lg:row-span-2')}>{hero}</div>
      {children && <div className="lg:col-start-1 lg:row-start-2 lg:self-start">{children}</div>}
    </header>
  );
}
