import { shortDay } from '@/components/site/admin/analytics/lib/format';
import { TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';

export type Cohort = { week: string; size: number; retained: (number | null)[] };

/** Retention triangle: each cohort week's share active in the weeks after, shaded in one hue. */
export function CohortTable({ cohorts, cohortLabel = 'Signed up (week of)', sizeLabel = 'Accounts' }: { cohorts: Cohort[]; cohortLabel?: string; sizeLabel?: string }) {
  const weeks = Math.max(0, ...cohorts.map(c => c.retained.length));
  return (
    <div className="overflow-x-auto">
      <table className={`${TABLE} text-[12px]`}>
        <thead>
          <tr>
            <th className={TH}>{cohortLabel}</th>
            <th className={`${TH} text-right`}>{sizeLabel}</th>
            {Array.from({ length: weeks }, (_, i) => <th key={i} className={`${TH} text-center`}>Week {i}</th>)}
          </tr>
        </thead>
        <tbody>
          {cohorts.map(c => (
            <tr key={c.week}>
              <td className={`${TD} whitespace-nowrap text-ink-2`}>{shortDay(c.week)}</td>
              <td className={`${TD} text-right font-mono tabular-nums`}>{c.size.toLocaleString('en')}</td>
              {Array.from({ length: weeks }, (_, i) => {
                const share = c.retained[i];
                if (share == null) return <td key={i} className={TD} />;
                return (
                  <td key={i} className="border-b border-line p-[2px]">
                    <div
                      className="flex h-7 items-center justify-center rounded-[4px] font-mono tabular-nums text-[11px] text-ink-1"
                      style={{ background: share > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(12 + share * 48)}%, var(--surface-1))` : 'var(--surface-2)' }}
                      title={`${Math.round(share * 100)}% of the ${shortDay(c.week)} cohort active in week ${i}`}
                    >
                      {Math.round(share * 100)}%
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
