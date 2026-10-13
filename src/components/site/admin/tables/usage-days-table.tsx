import { TABLE, TD, TH } from '@/components/site/admin/parts/admin-parts';
import type { UsageSeries } from '@/components/site/admin/admin-types';

const MAX_GROUPS = 8;

/** Newest day first; a click picks the day for the top callers. Groups beyond the busiest few are summed as "other". */
export default function UsageDaysTable({ series, selected, onSelect }: { series: UsageSeries; selected: string; onSelect: (day: string) => void }) {
  const shown = series.groups.slice(0, MAX_GROUPS);
  const rest = series.groups.slice(MAX_GROUPS);
  const peak = Math.max(1, ...series.days.map(d => d.requests + d.denied));
  const days = [...series.days].reverse();

  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>Day (UTC)</th>
            <th className={`${TH} w-48`}>Requests</th>
            <th className={`${TH} text-right`}>Refused</th>
            {shown.map(group => <th key={group} className={`${TH} text-right`}>{group}</th>)}
            {rest.length > 0 && <th className={`${TH} text-right`} title={rest.join(', ')}>other</th>}
          </tr>
        </thead>
        <tbody>
          {days.map(d => {
            const other = rest.reduce((sum, group) => sum + (d.groups[group]?.requests ?? 0), 0);
            return (
              <tr
                key={d.day}
                onClick={() => onSelect(d.day)}
                className={`cursor-pointer ${d.day === selected ? 'bg-surface-3' : 'hover:bg-surface-2'}`}
              >
                <td className={`${TD} whitespace-nowrap font-mono text-[11px]`}>{d.day}</td>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-3">
                      <div className="h-full flex" style={{ width: `${((d.requests + d.denied) / peak) * 100}%` }}>
                        <div className="h-full bg-ink-2" style={{ flex: d.requests }} />
                        <div className="h-full bg-red" style={{ flex: d.denied }} />
                      </div>
                    </div>
                    <span className="w-14 text-right font-mono tabular-nums">{d.requests.toLocaleString('en')}</span>
                  </div>
                </td>
                <td className={`${TD} text-right font-mono tabular-nums ${d.denied ? 'text-red' : 'text-ink-3'}`}>{d.denied.toLocaleString('en')}</td>
                {shown.map(group => {
                  const counts = d.groups[group];
                  return (
                    <td key={group} className={`${TD} text-right font-mono tabular-nums ${counts ? '' : 'text-ink-3'}`}>
                      {(counts?.requests ?? 0).toLocaleString('en')}
                      {counts?.denied ? <span className="block text-[11px] text-red">{counts.denied} refused</span> : null}
                    </td>
                  );
                })}
                {rest.length > 0 && <td className={`${TD} text-right font-mono tabular-nums text-ink-3`}>{other.toLocaleString('en')}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
