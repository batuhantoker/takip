import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { INDICATOR_GROUPS, type IndicatorSpec } from '@/lib/platform/site/places/topics/indicators-data';

/** Every measure the countries share, by group, the one shown marked: the way to the next chart without scrolling back. */
export function MeasureNav({ title, overview, specs, current, href, rel, t }: {
  title: string;
  overview: { href: string; label: string; rel?: string };
  specs: IndicatorSpec[];
  current: string;
  href: (slug: string) => string;
  rel?: (slug: string) => string | undefined;
  t: Translate;
}) {
  const item = 'block rounded-control px-2 py-1 text-[13px]';
  return (
    <nav aria-label={title} className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink-1">{title}</h2>
        <Link href={overview.href} rel={overview.rel} className={cx(item, '-mx-2 mt-1 text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING)}>{overview.label}</Link>
      </div>
      {INDICATOR_GROUPS.map(g => {
        const inGroup = specs.filter(s => s.group === g.id);
        if (!inGroup.length) return null;
        return (
          <div key={g.id}>
            <h3 className="text-[12px] font-medium text-ink-3">{t(g.label)}</h3>
            <ul className="-mx-2 mt-1">
              {inGroup.map(s => (
                <li key={s.slug}>
                  {s.slug === current
                    ? <span aria-current="page" className={cx(item, 'bg-surface-2 font-medium text-ink-1')}>{t(s.label)}</span>
                    : <Link href={href(s.slug)} rel={rel?.(s.slug)} className={cx(item, 'text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING)}>{t(s.label)}</Link>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
