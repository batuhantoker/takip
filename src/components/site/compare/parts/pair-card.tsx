import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { BOX, domainOf, linePath, points, scales } from '@/components/site/places/topics/lib/chart-geometry';
import type { Translate } from '@/lib/core/i18n/translator';
import { SERIES_INK } from '@/lib/map/style/tokens';
import type { PairMeasure } from '@/lib/platform/site/compare/compare';
import { formatValue } from '@/lib/platform/site/places/topics/indicators-facts';
import type { Yearly } from '@/lib/platform/site/places/topics/indicators-data';


/** Two countries' shapes over the years on one small scale: estimates solid, projections dashed. */
function PairSparkline({ a, b, className }: { a: { e: Yearly; p?: Yearly }; b: { e: Yearly; p?: Yearly }; className?: string }) {
  const domain = domainOf([a.e, a.p, b.e, b.p]);
  if (!domain) return null;
  const s = scales(domain);
  const stroke = { vectorEffect: 'non-scaling-stroke' as const, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.5 };
  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} preserveAspectRatio="none" aria-hidden className={cx('overflow-visible', className)}>
      {[a, b].map((x, i) => (
        <g key={i}>
          <path d={linePath(points(x.e), s)} stroke={SERIES_INK[i]} {...stroke} />
          {x.p && <path d={linePath(points(x.p), s)} stroke={SERIES_INK[i]} strokeDasharray="3 3" opacity={0.8} {...stroke} />}
        </g>
      ))}
    </svg>
  );
}

/** One measure for both countries: each one's latest value, and the two lines. */
export function PairCard({ href, names, m, t, big = false }: { href: string; names: [string, string]; m: PairMeasure; t: Translate; big?: boolean }) {
  return (
    <Link href={href} className={cx('flex h-full flex-col gap-1.5 rounded-card border border-line bg-surface-1 p-3 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
      <span className="text-[14px] font-medium text-ink-1">{t(m.spec.label)}</span>
      {[m.a, m.b].map((s, i) => (
        <span key={i} className="flex items-baseline gap-1.5 text-[12px] leading-snug text-ink-3">
          <span aria-hidden className="size-2 shrink-0 translate-y-[1px] rounded-full" style={{ background: SERIES_INK[i] }} />
          <span>{t('{place}: {v} in {year}', { place: names[i], v: formatValue(m.spec, s.f.last[1], t), year: String(s.f.last[0]) })}</span>
        </span>
      ))}
      <PairSparkline a={m.a} b={m.b} className={cx('mt-1.5 w-full', big ? 'h-16' : 'h-8')} />
    </Link>
  );
}
