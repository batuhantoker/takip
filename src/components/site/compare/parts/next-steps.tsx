import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

export interface NextRow { label: string; links: { href: string; label: string; rel?: string }[] }

/**
 * Where to go after the answer, as rows of chips under a short label. On a phone each row scrolls sideways to the
 * screen's edge rather than wrapping, so the rows stay on the first screen.
 */
export function NextSteps({ rows, className }: { rows: NextRow[]; className?: string }) {
  const shown = rows.filter(r => r.links.length);
  if (!shown.length) return null;
  return (
    <div className={cx('flex flex-col gap-4', className)}>
      {shown.map(row => (
        <nav key={row.label} aria-label={row.label}>
          <p aria-hidden className="text-[12px] font-medium text-ink-3">{row.label}</p>
          <ul className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {row.links.map(l => (
              <li key={l.href} className="shrink-0">
                <Link href={l.href} rel={l.rel}
                  className={cx('inline-flex h-8 items-center rounded-full border border-line bg-surface-1 px-3 text-[13px] whitespace-nowrap text-ink-1 hover:border-line-strong hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}
