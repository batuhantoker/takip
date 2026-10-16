'use client';

import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { CountryPick, CountryView } from '@/lib/history/countries/view';
import { nameOf } from '@/lib/history/countries/indicator-groups';
import { countryReading, formatValue, readingText } from '@/lib/history/series';

/**
 * The picks that aren't colouring the map, each read for the country under the pointer on its own scale.
 * Rows stay put with a dash while nothing is pointed at, so the card doesn't jump. A row colours the map by its pick.
 */
export function PickReadings({ view, picks, hoveredKey, y }: { view: CountryView; picks: CountryPick[]; hoveredKey: string | null; y: number }) {
  return (
    <ul className="mt-3 flex flex-col border-t border-line pt-2">
      {picks.map(p => {
        const name = nameOf(p, true);
        let text = '—';
        let tone = 'text-ink-4';
        let fill: number | null = null;
        let detail: string | undefined;
        if (p.status === 'loading') [text, tone] = ['Loading…', 'text-ink-3'];
        else if (p.status === 'error') [text, tone] = ['Couldn’t load', 'text-red'];
        else if (hoveredKey) {
          const r = countryReading(p.data, hoveredKey, y);
          if (!r) [text, tone] = ['No data', 'text-ink-3'];
          else {
            text = `${r.kind === 'interpolated' ? '≈ ' : ''}${formatValue(r.shown, p.data.metric.unit)}`;
            tone = 'font-mono text-ink-1 tabular-nums';
            fill = p.scale.norm(r.v);
            detail = readingText(r, p.data.metric.unit, p.data.names, p.data.step, p.data.projection?.label);
          }
        }
        return (
          <li key={p.code}>
            <button type="button" title={detail} aria-label={`${name}${text === '—' ? '' : `, ${text}`}. Colour the map by it`} onClick={() => view.select(p.code)}
              className={cx('-mx-2 flex min-h-7 w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 text-left text-small hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
              <span className="min-w-0 flex-1 truncate text-ink-2">{name}</span>
              <span className={cx('shrink-0', tone)}>{text}</span>
              <span aria-hidden className="relative h-1 w-10 shrink-0 overflow-hidden rounded-full bg-surface-3">
                {fill !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-ink-3" style={{ width: `${Math.max(4, fill * 100)}%` }} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
