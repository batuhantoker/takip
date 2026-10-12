'use client';

import { useMemo, useState } from 'react';
import { FileDown, Table } from 'lucide-react';
import { queryArea, type DrawnShape } from '@/lib/draw';
import { selectInArea, MAX_ITEMS_PER_GROUP } from '@/lib/aoi';
import { contentsToCSV, contentsToGeoJSON, downloadFile } from '@/lib/aoi-export';

interface AoiContentsProps {
  shape: DrawnShape;
  data?: Record<string, unknown>;
  onLocateEntity?: (lat: number, lng: number) => void;
}

/**
 * What is inside a selected area. Recomputed from the live store, so the readout tracks aircraft
 * moving through the area rather than freezing at the moment it was drawn.
 */
export default function AoiContents({ shape, data, onLocateEntity }: AoiContentsProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const area = queryArea(shape);
  // A country against ~28k live objects is too slow to redo on every panel render.
  const report = useMemo(() => (area ? selectInArea(area, data || {}) : null), [area, data]);
  if (!report) return null;

  const fileStem = `${shape.name.replace(/[\s,]+/g, '-')}-contents-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="mt-2 pt-2 border-t border-white/[0.06]">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[10px] font-mono tracking-[0.2em] text-white/40">CONTENTS</span>
        <span className="text-[11px] font-mono text-white tabular-nums">{report.total.toLocaleString()}</span>
        <span className="text-[10px] font-mono text-white/30">object{report.total === 1 ? '' : 's'}</span>
      </div>
      {report.total === 0 && (
        <p className="text-[10px] font-mono text-white/30 pb-1">Nothing tracked inside this area.</p>
      )}
      {report.groups.map(g => (
        <div key={g.key} className="mb-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setOpenGroup(openGroup === g.key ? null : g.key); }}
            className="w-full flex items-center gap-2 py-0.5 hover:bg-white/[0.03] rounded"
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
            <span className="text-[10px] font-mono text-white/70 flex-1 text-left">{g.label}</span>
            <span className="text-[10px] font-mono text-white tabular-nums">{g.count.toLocaleString()}</span>
          </button>
          {openGroup === g.key && (
            <div className="pl-3.5 mt-0.5">
              {g.items.map(it => (
                <button
                  key={it.id}
                  onClick={(e) => { e.stopPropagation(); onLocateEntity?.(it.lat, it.lng); }}
                  className="w-full flex items-baseline gap-2 py-0.5 text-left hover:bg-white/[0.04] rounded px-1"
                >
                  <span className="text-[10px] font-mono text-white/80 truncate">{it.label}</span>
                  {it.detail && <span className="text-[10px] font-mono text-white/30 truncate">{it.detail}</span>}
                </button>
              ))}
              {g.count > MAX_ITEMS_PER_GROUP && (
                <p className="text-[10px] font-mono text-white/25 px-1 py-0.5">
                  +{(g.count - MAX_ITEMS_PER_GROUP).toLocaleString()} more not listed
                </p>
              )}
            </div>
          )}
        </div>
      ))}
      {report.total > 0 && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-white/[0.06]">
          {/* Finding the objects is only half of it; the next stop is usually a spreadsheet. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadFile(`${fileStem}.csv`, contentsToCSV(shape, report), 'text/csv');
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-mono tracking-wider border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06] transition"
          >
            <Table className="w-2.5 h-2.5" /> CSV
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadFile(`${fileStem}.geojson`, JSON.stringify(contentsToGeoJSON(shape, report), null, 2), 'application/geo+json');
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-mono tracking-wider border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06] transition"
          >
            <FileDown className="w-2.5 h-2.5" /> GEOJSON
          </button>
        </div>
      )}
    </div>
  );
}
