'use client';

import { RotateCw } from 'lucide-react';
import { Button, Select } from '@/components/site/admin/parts/admin-parts';
import { Toolbar } from '@/components/site/admin/parts/area-page';
import { RANGES, type Range, type RangeId } from '../lib/use-range';
import { zoneName } from '../lib/zone';

/**
 * The range and refresh in the title row, and the line under it saying which clock the tab's times use. `byDay`: the
 * tab is only kept by day, so a window of hours shows the last 7 days; `local`: its days start at the viewer's midnight.
 */
export function RangeControls({ r, byDay = false, local = false, loading }: { r: Range; byDay?: boolean; local?: boolean; loading: boolean }) {
  return (
    <>
      <Toolbar>
        <Select value={byDay && r.hours ? '7d' : r.span} onChange={e => r.setSpan(e.target.value as RangeId)} aria-label="Range">
          {RANGES.map(o => <option key={o.id} value={o.id} disabled={byDay && o.unit === 'hours'}>{o.label}</option>)}
        </Select>
        <Button aria-label="Refresh" title="Refresh" className="px-2" onClick={r.refresh}>
          <RotateCw aria-hidden className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} strokeWidth={1.75} />
        </Button>
      </Toolbar>
      <p className="text-[12px] text-ink-3">
        {local
          ? `Times and days are in your time zone, ${zoneName()}, except where a card says it's kept by UTC day.`
          : `Times are in your time zone, ${zoneName()}. Days are UTC days, the way they're kept.`}
        {byDay && r.hours ? ' This tab is only kept by day, so it shows the last 7 days; Home, Growth and Visitors go down to the hour.' : ''}
      </p>
    </>
  );
}
