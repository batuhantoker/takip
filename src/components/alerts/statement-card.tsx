'use client';

import { ExternalLink, Image as ImageIcon, Play } from 'lucide-react';
import { timeAgo } from '@/lib/alert-digest';
import { ACCENT, blocColor, quoteOf, type NewsAlert } from '@/lib/live-alerts';

export default function StatementCard({ speaker, items, now, open, wide, onToggle }: {
  speaker: string; items: NewsAlert[]; now: number; open: boolean; wide?: boolean; onToggle: () => void;
}) {
  const lead = items[0];
  const color = blocColor(lead.bloc);
  const fresh = now - lead.ts < 15 * 60_000;
  return (
    <article
      className={`rounded-lg border border-l-2 transition-colors ${wide ? 'xl:col-span-2' : ''} ${open ? 'bg-[#15151A] border-[#3A3A38]' : 'bg-[#111111]/70 border-[#26262A] hover:bg-[#17171B] hover:border-[#34343A]'}`}
      style={{ borderLeftColor: color }}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left px-2.5 pt-2 pb-1.5 outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] font-mono uppercase tracking-wider">
            {fresh && <span className="w-1.5 h-1.5 rounded-full animate-osiris-pulse" style={{ background: ACCENT }} title="Posted in the last 15 minutes" />}
            <span className="font-semibold text-[#E8E6E0]">{lead.source_name}</span>
            {lead.lean && <span style={{ color }}>{lead.lean}</span>}
          </div>
          <time dateTime={lead.published} title={new Date(lead.ts).toLocaleString()} className="flex-shrink-0 text-[9.5px] font-mono text-[#8A8880]">
            {timeAgo(lead.ts, now)}
          </time>
        </div>
        <h4 className="mt-1 font-sans text-[12.5px] font-medium leading-snug text-[#F2EFE8]">
          {items.some(i => i.flag) && <span className="mr-1.5 inline-block translate-y-[-1px] rounded bg-[#FF3D3D]/15 px-1 text-[8.5px] font-mono font-bold tracking-wider text-[#FF6B6B]">BREAKING</span>}
          {speaker}
          <span className="ml-1.5 whitespace-nowrap text-[9px] font-mono font-normal tracking-wider text-[#8A8880]">{items.length} STATEMENTS</span>
        </h4>
      </button>
      <ol className="px-2.5 pb-2 space-y-1">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-1.5 border-l border-white/10 pl-2">
            <p className={`flex-1 min-w-0 font-sans text-[11px] leading-relaxed text-[#C9C5BC] whitespace-pre-line ${open ? '' : 'line-clamp-2'}`}>
              {quoteOf(item, speaker, open)}
            </p>
            <span className="flex flex-shrink-0 items-center gap-1 pt-0.5 text-[9px] font-mono text-[#5C5A54]">
              {item.media && (item.media.kind === 'video' ? <Play className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />)}
              {timeAgo(item.ts, now).replace(' ago', '')}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[var(--cyan-primary)] hover:opacity-70" aria-label="Open this statement on Telegram">
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
