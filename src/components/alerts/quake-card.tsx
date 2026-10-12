'use client';

import { MapPin, ExternalLink, Waves } from 'lucide-react';
import { timeAgo } from '@/lib/alert-digest';
import { PAGER_COLORS, quakeColor, type QuakeAlert } from '@/lib/live-alerts';
import Chip from './chip';

export default function QuakeCard({ item, now, onLocate }: { item: QuakeAlert; now: number; onLocate: (lat: number, lng: number) => void }) {
  const color = quakeColor(item.magnitude);
  return (
    <article className="rounded-lg border border-[#26262A] border-l-2 bg-[#111111]/70 hover:bg-[#17171B] transition-colors" style={{ borderLeftColor: color }}>
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <button
          type="button"
          onClick={() => onLocate(item.lat, item.lng)}
          title="Show on map"
          className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-md font-mono transition-transform hover:scale-105"
          style={{ background: `${color}1c`, border: `1px solid ${color}55`, color }}
        >
          <span className="text-[13px] font-bold leading-none">{item.magnitude.toFixed(1)}</span>
          <span className="mt-0.5 text-[7px] tracking-widest">MAG</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-sans text-[12px] leading-snug text-[#F2EFE8] line-clamp-2">{item.place}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] font-mono text-[#8A8880]">
            <time dateTime={new Date(item.ts).toISOString()} title={new Date(item.ts).toLocaleString()}>{timeAgo(item.ts, now)}</time>
            {item.depth != null && <span>· {Math.round(item.depth)} km deep</span>}
            {item.felt ? <span>· felt by {item.felt.toLocaleString()}</span> : null}
          </div>
          {(item.tsunami || item.pager) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.tsunami && <Chip color="#448AFF"><Waves className="w-2 h-2" /> tsunami flag</Chip>}
              {item.pager && <Chip color={PAGER_COLORS[item.pager] || '#8A8880'} title="USGS PAGER impact alert level">PAGER {item.pager}</Chip>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button type="button" onClick={() => onLocate(item.lat, item.lng)} className="p-1 rounded text-[#8A8880] hover:text-white hover:bg-white/10" aria-label="Show on map">
            <MapPin className="w-3 h-3" />
          </button>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-[var(--cyan-primary)] hover:bg-white/10" aria-label="Open USGS event page">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
