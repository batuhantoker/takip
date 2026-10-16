'use client';
/**
 * TAKIP TI: the small parts the forecast views share: TI's mark, an actor's
 * initials, where a world stands, a move's stance, and the icon for each kind
 * of object.
 */
import { createElement, type CSSProperties } from 'react';
import {
  Activity, BookOpen, Building2, CalendarClock, CandlestickChart, ChartLine, Crown, Database, Factory, FileText, GitBranch, Globe2, Landmark, Link2,
  MapPin, MessageCircle, Newspaper, Orbit, Quote, Scale, ScrollText, Signpost, Swords, TrendingUp, Users, Zap, type LucideIcon, type LucideProps,
} from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { Tag } from '@/components/ui/tag';
import { pointView } from '@/lib/ai/forecast';
import { mentions } from '@/lib/ai/workspace/objects';
import type { RunState } from '@/lib/ai/state';
import type { Frame, LinkKind, Move, WorldPoint } from '@/lib/ai/types';
import { initials, sentence } from './theme';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

const ORBIT: CSSProperties = { transformOrigin: '12px 12px' };

/** TI's mark: a gold core in its ring, with a body in orbit that turns while TI is at work. */
export function AiMark({ size = 16, live = false, className }: { size?: number; live?: boolean; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={cx('shrink-0', className)}>
      <circle cx="12" cy="12" r="8.5" className="stroke-gold" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" className="fill-gold" />
      <g style={ORBIT} className={live ? 'animate-spin [animation-duration:3.2s] motion-reduce:animate-none' : undefined}>
        <circle cx="12" cy="3.5" r="2.1" className="fill-gold" fillOpacity="0.7" />
      </g>
    </svg>
  );
}

/** The mark as a panel icon: still, or turning while TI works. */
export const TiGlyph = ({ className }: { className?: string }) => <AiMark className={className} />;
export const TiGlyphLive = ({ className }: { className?: string }) => <AiMark className={className} live />;

export function Avatar({ name, size = 28, ring }: { name: string; size?: number; ring?: 'selected' | 'thinking' }) {
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full bg-surface-3 font-medium text-ink-2',
        ring === 'selected' ? 'ring-1 ring-gold' : ring === 'thinking' ? 'ring-1 ring-gold/40' : 'ring-1 ring-line',
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}>
      {initials(name)}
    </span>
  );
}

/** Where a world stands in figures; how it resolved once it has. */
export function PointTag({ point, frame }: { point: WorldPoint; frame: Frame | null }) {
  const said = sentence(pointView(point, frame));
  const view = point.resolved && /^(Yes|No)$/.test(said) ? said.toLowerCase() : said;
  return (
    <span title={point.resolved ? 'Resolved in this world' : 'Where the question stands in this world'}
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] border border-line-strong px-1.5 text-meta leading-none font-medium whitespace-nowrap text-ink-1">
      {point.resolved && <span className="text-ink-3">Resolved</span>}
      <span><Figures text={view} /></span>
    </span>
  );
}

/** How an actor's move stands toward the actors it is aimed at. */
export const STANCE: Record<Move['stance'], string> = { cooperate: 'Cooperates', pressure: 'Presses', oppose: 'Opposes', hold: 'Holds' };

export function StanceTag({ stance }: { stance: Move['stance'] }) {
  return <Tag>{STANCE[stance]}</Tag>;
}

/* ───────────── Object types ───────────── */

const ACTOR_ICON: Record<string, LucideIcon> = {
  state: Landmark, leader: Crown, organisation: Building2, company: Factory, market: TrendingUp, group: Users, place: MapPin,
};
const SOURCE_ICON: Record<string, LucideIcon> = {
  news: Newspaper, social: MessageCircle, quake: Activity, market: CandlestickChart, series: ChartLine, odds: Scale, data: Database, web: Globe2, wiki: BookOpen,
};
export const LINK_ICON: Record<LinkKind, LucideIcon> = { relation: Link2, evidence: FileText, move: Swords, cite: Quote };

/** The icon for an object, from its research key's prefix and its subtype. */
export function iconFor(key: string, subtype = ''): LucideIcon {
  const prefix = key.split(':')[0];
  if (prefix === 'a') return ACTOR_ICON[subtype] ?? Landmark;
  if (prefix === 'c') return SOURCE_ICON[subtype] ?? Newspaper;
  if (prefix === 'e') return subtype === 'shock' || subtype === 'injected' ? Zap : CalendarClock;
  if (prefix === 'w') return Orbit;
  if (prefix === 's') return GitBranch;
  if (prefix === 'p') return Signpost;
  if (prefix === 'r') return ScrollText;
  return Link2;
}

/** An object's icon, by its research key and subtype, or a link's by its kind. */
export function TypeIcon({ k, subtype, link, ...rest }: LucideProps & { k: string; subtype?: string; link?: LinkKind }) {
  return createElement(link ? LINK_ICON[link] : iconFor(k, subtype), { strokeWidth: 1.75, ...rest });
}

/** The ink an object's icon wears: gold for the actors and the report, TI's own reading; neutral for the rest. */
export function accentFor(key: string): string {
  const prefix = key.split(':')[0];
  return prefix === 'a' || prefix === 'r' ? 'text-gold' : 'text-ink-3';
}

/**
 * Text with the run's actors and sources in it made clickable: the same
 * sentence an actor said, but "China" opens China.
 */
export function Mentions({ text, s, onSelect }: { text: string; s: RunState; onSelect: (key: string) => void }) {
  const parts = mentions(text, s);
  return (
    <>
      {parts.map((p, i) => typeof p === 'string' ? <span key={i}>{p}</span> : (
        <button key={i} type="button" onClick={e => { e.stopPropagation(); onSelect(p.key); }}
          className="text-inherit underline decoration-ink-4 decoration-dotted underline-offset-2 transition-colors hover:text-ink-1 hover:decoration-ink-2 focus-visible:outline-2 focus-visible:outline-accent">
          {p.text}
        </button>
      ))}
    </>
  );
}
