import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import type { SideBySide } from '@/lib/platform/site/compare/compare-copy';
import { formatNumber } from '@/lib/platform/site/places/topics/indicators-facts';
import { INDICATOR_GROUPS, type IndicatorSpec } from '@/lib/platform/site/places/topics/indicators-data';

export interface HeadToHeadRow { spec: IndicatorSpec; side: SideBySide; href: string; rel?: string }

// On a phone the bars take a line of their own under the measure and the difference.
const ROW = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_5.5rem]';
const MIDDLE = 'order-last col-span-2 grid grid-cols-2 items-center gap-0.5 sm:order-none sm:col-span-1';

/** One country's bar, out from the middle to scale against the other's; the higher one strong. */
function Bar({ v, top, slot, strong }: { v: number; top: number; slot: 0 | 1; strong: boolean }) {
  return (
    <span aria-hidden className={cx('flex h-2 min-w-0 flex-1', slot === 0 && 'justify-end')}>
      <span className={cx('block h-full', slot === 0 ? 'rounded-l-full' : 'rounded-r-full')}
        style={{ width: `${(Math.abs(v) / top) * 100}%`, background: SERIES_INK[slot], opacity: v < 0 ? 0.3 : strong ? 0.9 : 0.45 }} />
    </span>
  );
}

/**
 * Two countries measure by measure under their groups: each one's figure either side of bars that grow out from the
 * middle, and how many times the higher is the lower, else the gap, marked in the higher one's colour.
 */
export function HeadToHead({ countries, rows, t }: { countries: [string, string]; rows: HeadToHeadRow[]; t: Translate }) {
  const name = (slot: 0 | 1) => (
    <span className={cx('flex min-w-0 items-center gap-1.5', slot === 0 && 'justify-end')}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: SERIES_INK[slot] }} />
      <span className="truncate">{countries[slot]}</span>
    </span>
  );
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-1 text-[13px]">
      <div className={cx(ROW, 'bg-surface-2 py-2 font-medium text-ink-3')}>
        <span>{t('Measure')}</span>
        <div className={MIDDLE}>{name(0)}<span className="pl-2">{name(1)}</span></div>
        <span className="text-right">{t('Difference')}</span>
      </div>
      {INDICATOR_GROUPS.map(g => {
        const inGroup = rows.filter(r => r.spec.group === g.id);
        if (!inGroup.length) return null;
        return (
          <section key={g.id} aria-label={t(g.label)}>
            <h3 className="border-t border-line bg-surface-2/40 px-3 pt-4 pb-2 text-[12px] font-semibold text-ink-2">{t(g.label)}</h3>
            <ul className="divide-y divide-line">
              {inGroup.map(({ spec, side, href, rel }) => {
                const n = (v: number) => formatNumber(v, spec.style, spec.digits, t);
                const top = Math.max(Math.abs(side.a[1]), Math.abs(side.b[1])) || 1;
                const shared = side.a[0] === side.b[0];
                const value = (slot: 0 | 1) => {
                  const [year, v] = slot ? side.b : side.a;
                  return (
                    <span className="shrink-0 font-mono whitespace-nowrap text-ink-1 tabular-nums">
                      {n(v)}{!shared && <span className="ml-1 text-[11px] text-ink-3">{year}</span>}
                    </span>
                  );
                };
                const lead = side.lead === 'a' ? 0 : side.lead === 'b' ? 1 : undefined;
                return (
                  <li key={spec.slug} className={cx(ROW, 'py-2.5 hover:bg-surface-2/60')}>
                    <div className="min-w-0">
                      <Link href={href} rel={rel} className={cx('text-ink-1 hover:text-accent', FOCUS_RING)}>{t(spec.label)}</Link>
                      <span className="block text-[11px] text-ink-3">{t(spec.unit)}{shared && ` · ${side.a[0]}`}</span>
                    </div>
                    <div className={MIDDLE}>
                      <span className="flex min-w-0 items-center gap-2">{value(0)}<Bar v={side.a[1]} top={top} slot={0} strong={lead === 0} /></span>
                      <span className="flex min-w-0 items-center gap-2"><Bar v={side.b[1]} top={top} slot={1} strong={lead === 1} />{value(1)}</span>
                    </div>
                    <span className="flex items-center justify-end gap-1.5 font-mono text-[12px] whitespace-nowrap text-ink-2 tabular-nums">
                      {lead !== undefined && (
                        <>
                          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: SERIES_INK[lead] }} />
                          <span className="sr-only">{countries[lead]}</span>
                        </>
                      )}
                      {side.lead === 'tie' ? '=' : side.ratio ? `${side.ratio}×` : side.gap !== undefined ? `+${n(side.gap)}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
