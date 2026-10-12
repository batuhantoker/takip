'use client';

import { MapPin, ExternalLink, AlertTriangle } from 'lucide-react';
import { timeAgo } from '@/lib/alert-digest';
import { SEVERITY_COLORS, expiryLabel, type LocateOptions, type WarningAlert } from '@/lib/live-alerts';
import Chip from './chip';

export default function WarningCard({ item, now, onLocate }: { item: WarningAlert; now: number; onLocate: (lat: number, lng: number, options?: LocateOptions) => void }) {
  const color = SEVERITY_COLORS[item.severity];
  const left = item.expires != null ? expiryLabel(item.expires, now) : null;
  return (
    <article className="rounded-lg border border-[#26262A] border-l-2 bg-[#111111]/70 hover:bg-[#17171B] transition-colors" style={{ borderLeftColor: color }}>
      <div className="px-2.5 py-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] font-mono uppercase tracking-wider">
            <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" style={{ color }} />
            <span className="font-semibold" style={{ color }}>{item.type}</span>
            <span className="text-[#8A8880]">{item.provider}</span>
          </div>
          <time dateTime={new Date(item.ts).toISOString()} title={new Date(item.ts).toLocaleString()} className="flex-shrink-0 text-[9.5px] font-mono text-[#8A8880]">
            {timeAgo(item.ts, now)}
          </time>
        </div>

        <p className="mt-1 font-sans text-[12px] leading-snug text-[#F2EFE8] line-clamp-3">{item.title}</p>

        {item.area && (
          <p className="mt-1 font-sans text-[10.5px] leading-snug text-[#9B978E] line-clamp-2" title={item.area}>{item.area}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Chip color={color} title="As the issuer graded it">{item.severity} severity</Chip>
          {left && <Chip color={left === 'expired' ? '#5C5A54' : '#8A8880'} title={`Runs until ${new Date(item.expires!).toLocaleString()}`}>{left}</Chip>}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onLocate(item.lat, item.lng, { zoom: 6 })}
              title="Show where this was issued"
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[9.5px] font-mono tracking-wider hover:bg-white/5"
              style={{ color, borderColor: `${color}55` }}
            >
              <MapPin className="w-2.5 h-2.5" /> SHOW
            </button>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-[var(--cyan-primary)] hover:bg-white/10" aria-label={`Open the ${item.provider} notice`}>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
