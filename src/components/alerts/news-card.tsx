'use client';

import { useState } from 'react';
import { MapPin, ExternalLink, Image as ImageIcon, Play, Eye, Repeat2, CornerDownRight, Layers } from 'lucide-react';
import { ALERT_KINDS, BLOCS, timeAgo } from '@/lib/alert-digest';
import { ACCENT, blocColor, compactCount, type LocateOptions, type NewsAlert } from '@/lib/live-alerts';
import Chip from './chip';

export default function NewsCard({ item, now, open, wide, onToggle, onLocate }: {
  item: NewsAlert; now: number; open: boolean; wide?: boolean; onToggle: () => void; onLocate: (lat: number, lng: number, options?: LocateOptions) => void;
}) {
  const color = blocColor(item.bloc);
  const fresh = now - item.ts < 15 * 60_000;
  const [mediaFailed, setMediaFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const kind = ALERT_KINDS[item.alertKind];
  const video = item.media?.video && !videoFailed ? item.media.video : null;

  return (
    <article
      className={`rounded-lg border border-l-2 transition-colors ${wide ? 'xl:col-span-2' : ''} ${open ? 'bg-[#15151A] border-[#3A3A38]' : 'bg-[#111111]/70 border-[#26262A] hover:bg-[#17171B] hover:border-[#34343A]'}`}
      style={{ borderLeftColor: color }}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left px-2.5 pt-2 pb-2 outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] font-mono uppercase tracking-wider">
            {fresh && <span className="w-1.5 h-1.5 rounded-full animate-osiris-pulse" style={{ background: ACCENT }} title="Posted in the last 15 minutes" />}
            <span className="font-semibold text-[#E8E6E0]">{item.source_name}</span>
            {item.lean && <span style={{ color }} title={item.bloc ? BLOCS[item.bloc].label : undefined}>{item.lean}</span>}
          </div>
          <time dateTime={item.published} title={new Date(item.ts).toLocaleString()} className="flex-shrink-0 text-[9.5px] font-mono text-[#8A8880]">
            {timeAgo(item.ts, now)}
          </time>
        </div>

        <h4 className={`mt-1 font-sans text-[12.5px] font-medium leading-snug text-[#F2EFE8] ${open ? '' : 'line-clamp-3'}`}>
          {item.flag && <span className="mr-1.5 inline-block translate-y-[-1px] rounded bg-[#FF3D3D]/15 px-1 text-[8.5px] font-mono font-bold tracking-wider text-[#FF6B6B]">BREAKING</span>}
          {item.title}
        </h4>
        {!open && item.summary && (
          <p className="mt-1 font-sans text-[11px] leading-relaxed text-[#9B978E] line-clamp-2">{item.summary}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {item.alertKind !== 'news' && <Chip color={kind.color}>{kind.label}</Chip>}
          {item.place && (
            <Chip color={kind.color} title={`Pinned to ${item.place.label} — the place the post names`}>
              <MapPin className="w-2 h-2" /> <span className="max-w-[110px] truncate normal-case">{item.place.name}</span>
            </Chip>
          )}
          {item.media && (
            <Chip title={item.media.count > 1 ? `${item.media.count} media items` : undefined}>
              {item.media.kind === 'video' ? <Play className="w-2 h-2" /> : <ImageIcon className="w-2 h-2" />}
              {item.media.kind === 'video' ? (item.media.duration || 'video') : 'photo'}
              {item.media.count > 1 && ` +${item.media.count - 1}`}
            </Chip>
          )}
          {item.carriers.length > 0 && (
            <Chip color="#00E5FF" title={`Also carried by ${item.carriers.map(c => c.source_name).join(', ')}`}>
              <Layers className="w-2 h-2" /> +{item.carriers.length} channel{item.carriers.length > 1 ? 's' : ''}
            </Chip>
          )}
          {item.forwarded_from && (
            <Chip title={`Forwarded from ${item.forwarded_from.name}`}>
              <Repeat2 className="w-2 h-2" /> <span className="max-w-[110px] truncate normal-case">{item.forwarded_from.name}</span>
            </Chip>
          )}
          {item.reply_to && <Chip><CornerDownRight className="w-2 h-2" /> reply</Chip>}
          {item.keywords.slice(0, 2).map(k => (
            <Chip key={k} color="#FF9500" title="Matched by the conflict-keyword filter — a word match, not an assessment">{k}</Chip>
          ))}
          {item.views != null && (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[8.5px] font-mono text-[#5C5A54]" title={`${item.views.toLocaleString()} views`}>
              <Eye className="w-2.5 h-2.5" /> {compactCount(item.views)}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {video && (
            <video
              src={video}
              poster={item.media?.thumb ?? undefined}
              controls
              playsInline
              preload="none"
              onError={() => setVideoFailed(true)}
              className="block max-h-64 w-full max-w-[560px] rounded-md border border-white/5 bg-black"
            />
          )}

          {!video && item.media?.thumb && !mediaFailed && (
            <a href={item.link ?? undefined} target="_blank" rel="noopener noreferrer" className="relative block max-w-[560px] overflow-hidden rounded-md border border-white/5 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote CDN preview, loaded only on expand */}
              <img
                src={item.media.thumb}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setMediaFailed(true)}
                className="max-h-52 w-full object-cover"
              />
              {item.media.kind === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-mono text-white">
                    <Play className="w-3 h-3" /> WATCH ON TELEGRAM{item.media.duration ? ` · ${item.media.duration}` : ''}
                  </span>
                </span>
              )}
            </a>
          )}

          {item.summary && (
            <div className="max-h-56 overflow-y-auto styled-scrollbar pr-1 font-sans text-[11.5px] leading-relaxed text-[#C9C5BC] whitespace-pre-line">
              {item.summary}
            </div>
          )}

          {item.forwarded_from && (
            <div className="text-[10px] font-mono text-[#8A8880]">
              Forwarded from{' '}
              {item.forwarded_from.url
                ? <a href={item.forwarded_from.url} target="_blank" rel="noopener noreferrer" className="text-[var(--cyan-primary)] hover:underline">{item.forwarded_from.name}</a>
                : <span className="text-[#C9C5BC]">{item.forwarded_from.name}</span>}
            </div>
          )}

          {item.carriers.length > 0 && (
            <div>
              <div className="mb-1 text-[8.5px] font-mono tracking-widest text-[#5C5A54]">ALSO CARRIED BY</div>
              <ul className="space-y-0.5">
                {item.carriers.map(c => (
                  <li key={c.source} className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: blocColor(c.bloc) }} />
                    <span className="text-[#C9C5BC]">{c.source_name}</span>
                    {c.lean && <span className="truncate uppercase text-[8.5px]" style={{ color: blocColor(c.bloc) }}>{c.lean}</span>}
                    <span className="ml-auto flex-shrink-0 text-[#5C5A54]">{c.published ? timeAgo(c.published, now) : ''}</span>
                    {c.link && (
                      <a href={c.link} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-[var(--cyan-primary)] hover:opacity-70" aria-label={`Open ${c.source_name} post`}>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-[var(--cyan-primary)]/30 bg-[var(--cyan-primary)]/10 px-2 py-1 text-[9.5px] font-mono tracking-wider text-[var(--cyan-primary)] hover:bg-[var(--cyan-primary)]/20"
              >
                <ExternalLink className="w-2.5 h-2.5" /> OPEN POST
              </a>
            )}
            {item.reply_to && (
              <a
                href={item.reply_to}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[9.5px] font-mono tracking-wider text-[#9B978E] hover:bg-white/5"
              >
                <CornerDownRight className="w-2.5 h-2.5" /> IN REPLY TO
              </a>
            )}
            {item.coords && item.place && (
              <button
                type="button"
                onClick={() => onLocate(item.coords![0], item.coords![1], { zoom: item.place!.precision === 'settlement' ? 10 : 7, alertId: item.id })}
                title={`${item.place.label} — the place the post names. Town-level: a post names a place, not an exact spot.`}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[9.5px] font-mono tracking-wider hover:bg-white/5"
                style={{ color: kind.color, borderColor: `${kind.color}55` }}
              >
                <MapPin className="w-2.5 h-2.5" /> {item.place.name.toUpperCase()}
              </button>
            )}
            {item.coords && !item.place && (
              <button
                type="button"
                onClick={() => onLocate(item.coords![0], item.coords![1])}
                title={item.anchor ? `Approximate: the centroid for "${item.anchor}", not the event location` : 'Approximate location'}
                className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[9.5px] font-mono tracking-wider text-[#9B978E] hover:bg-white/5"
              >
                <MapPin className="w-2.5 h-2.5" /> ≈ {(item.anchor || 'region').toUpperCase()}
              </button>
            )}
            {item.bloc && (
              <span className="ml-auto text-[8.5px] font-mono tracking-wider" style={{ color }}>{BLOCS[item.bloc].label.toUpperCase()}</span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
