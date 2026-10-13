'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Download, ScanSearch } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { MenuItem } from '@/components/ui/menu-item';
import { PanelSection } from '@/components/ui/panel';
import { Popover } from '@/components/ui/popover';
import { queryArea, type DrawnShape } from '@/lib/areas/draw';
import { selectInArea, MAX_ITEMS_PER_GROUP } from '@/lib/areas/aoi';
import { contentsToCSV, contentsToGeoJSON, downloadFile } from '@/lib/areas/aoi-export';

/**
 * What is inside a selected area. Recomputed from the live store, so the readout tracks aircraft
 * moving through the area rather than freezing at the moment it was drawn.
 */
export default function AoiContents({ shape, data, onLocateEntity }: {
  shape: DrawnShape;
  data?: Record<string, unknown>;
  onLocateEntity?: (lat: number, lng: number) => void;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const area = queryArea(shape);
  // A country against ~28k live objects is too slow to redo on every panel render.
  const report = useMemo(() => (area ? selectInArea(area, data || {}) : null), [area, data]);

  if (!report) {
    return (
      <PanelSection title="Inside">
        <p className="text-small text-ink-3">A path measures distance; it doesn’t enclose anything to look inside.</p>
      </PanelSection>
    );
  }

  const stem = `${shape.name.replace(/[\s,]+/g, '-')}-contents-${new Date().toISOString().slice(0, 10)}`;
  const exportMenu = report.total > 0 && (
    <Popover role="menu" label="Export contents" placement="bottom" align="end" className="w-56 p-1"
      trigger={<Button variant="ghost" size="sm" icon={Download}>Export</Button>}>
      {close => (
        <>
          <MenuItem hint=".csv" onSelect={() => { downloadFile(`${stem}.csv`, contentsToCSV(shape, report), 'text/csv'); close(); }}>Spreadsheet</MenuItem>
          <MenuItem hint=".geojson" onSelect={() => { downloadFile(`${stem}.geojson`, JSON.stringify(contentsToGeoJSON(shape, report), null, 2), 'application/geo+json'); close(); }}>GeoJSON</MenuItem>
        </>
      )}
    </Popover>
  );

  return (
    <PanelSection title={`Inside ${shape.name}`} hint={report.total > 0 ? `${report.total.toLocaleString()} right now` : undefined} action={exportMenu}>
      {report.total === 0 ? (
        <p className="flex items-center gap-2 text-small text-ink-3">
          <ScanSearch aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          Nothing on the map is inside it right now. Turn on more layers to look for more.
        </p>
      ) : (
        <ul className="flex flex-col">
          {report.groups.map(g => {
            const open = openGroup === g.key;
            return (
              <li key={g.key}>
                {/* The dot is the layer's own colour on the map. */}
                <ListRow
                  leading={<span aria-hidden className="size-2 rounded-full" style={{ background: g.color }} />}
                  title={g.label}
                  trailing={
                    <>
                      <span className="font-mono text-small text-ink-2 tabular-nums">{g.count.toLocaleString()}</span>
                      <ChevronDown aria-hidden className={cx('size-4 text-ink-3 transition-transform duration-150 motion-reduce:transition-none', !open && '-rotate-90')} strokeWidth={1.75} />
                    </>
                  }
                  onClick={() => setOpenGroup(open ? null : g.key)}
                  aria-label={`${g.label}, ${g.count}. ${open ? 'Hide' : 'Show'} the list`}
                  compact
                />
                {open && (
                  <ul className="mb-2 ml-[7px] flex flex-col border-l border-line pl-5">
                    {g.items.map(it => (
                      <li key={it.id}>
                        <ListRow compact title={it.label} meta={it.detail} onClick={() => onLocateEntity?.(it.lat, it.lng)} aria-label={`Show ${it.label} on the map`} />
                      </li>
                    ))}
                    {g.count > MAX_ITEMS_PER_GROUP && (
                      <li className="py-1.5 text-meta text-ink-3">
                        {(g.count - MAX_ITEMS_PER_GROUP).toLocaleString()} more not listed. Export to see them all.
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PanelSection>
  );
}
