'use client';

import { useRef } from 'react';
import { Crosshair, Loader2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { norm, sub } from '@/lib/space/astro';
import { distance, speed } from '@/lib/space/format';
import type { HistoryEvent } from '@/lib/space/flight-history';
import { RATES, rateLabel, replayDate, span } from '@/lib/space/replay-format';
import type { ReplayModel } from '@/lib/space/replay-model';
import { wikiTopic } from '@/lib/space/wiki-topic';
import type { ReplayState } from '../scene/flight-replay';
import { useWiki } from '../use-wiki';

/**
 * TAKIP — the flight replay's controls: play and speed, a timeline marked
 * with the flight's events (launch, flybys, arrivals, today), and where the
 * craft is at the moment shown.
 */

const EVENT_COLOR: Record<HistoryEvent['kind'], string> = {
  launch: '#7CF7C4', flyby: '#F0D060', arrival: '#FF8A5C', landing: '#FF5C8A', crossing: '#7FB8FF', end: '#A9B8D6', now: '#FFFFFF',
};

const BUTTON = 'h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-white/[0.06] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:opacity-40';

export interface ReplayControls {
  play: () => void;
  pause: () => void;
  seek: (jd: number) => void;
  setRate: (days: number) => void;
  follow: (on: boolean) => void;
  close: () => void;
}

export default function FlightReplayBar({ name, model, state, error, controls }: {
  name: string;
  model: ReplayModel | null;
  state: ReplayState | null;
  error: string | null;
  controls: ReplayControls;
}) {
  const track = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const wiki = useWiki(wikiTopic({ kind: 'craft', id: state?.craftId ?? 0 }, name));

  if (!model || !state) {
    return (
      <Frame>
        <div className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-[var(--text-secondary)]">
          {error ? <span className="flex-1">JPL Horizons could not give {name}&apos;s flight: {error}</span> : (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--cyan-primary)]" />
              <span className="flex-1">Asking JPL Horizons for {name}&apos;s whole flight… the first time takes up to a minute.</span>
            </>
          )}
          <button type="button" onClick={controls.close} className={BUTTON} title="Close the replay" aria-label="Close the replay"><X className="h-3.5 w-3.5" /></button>
        </div>
      </Frame>
    );
  }

  const h = model.history;
  const at = (jd: number) => (jd - model.start) / (model.end - model.start);
  const jd = state.jd;
  const craft = model.craftAt(jd);
  const earthKm = norm(sub(craft, model.bodyAt('earth', jd)));
  const predicted = jd > h.fetchedJd;
  const next = h.events.find(e => e.jd > jd + 1e-6);
  const prev = [...h.events].reverse().find(e => e.jd < jd - 1 / 1440);
  const slowed = state.playing && state.effectiveRate < state.rate * 0.99;
  const slowedFor = slowed ? h.encounters.find(e => e.craft.some(t => jd >= t.t0 && jd <= t.t0 + (t.pos.length / 3 - 1) * t.step)) : null;

  const seekAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    controls.seek(model.start + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (model.end - model.start));
  };

  return (
    <Frame>
      <div className="flex items-center gap-2 px-3 pt-2.5">
        {wiki?.image ? (
          <a href={wiki.url} target="_blank" rel="noopener noreferrer" title={`${wiki.title} on Wikipedia`} className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnail */}
            <img src={wiki.image.src} alt={wiki.title} className="h-full w-full object-cover" />
          </a>
        ) : <span className="h-1.5 w-1.5 rounded-full bg-[#F0D060]" />}
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-semibold text-[var(--text-heading)]">{name}</span>
          {wiki?.description && <span className="block truncate text-[9px] text-[var(--text-muted)]">{wiki.description}</span>}
        </span>
        <span className="text-[9px] font-mono tracking-[0.15em] text-[var(--text-muted)]">FLIGHT REPLAY</span>
        <span className="ml-auto text-[11px] font-mono tabular-nums text-[var(--text-primary)]">{replayDate(jd)}</span>
        {predicted && <span className="rounded border border-[#7FDBFF]/40 px-1 text-[8px] font-mono tracking-[0.12em] text-[#7FDBFF]" title="Past today, this is JPL's predicted trajectory">PREDICTED</span>}
        {model.ascending(jd) && <span className="rounded border border-white/20 px-1 text-[8px] font-mono tracking-[0.12em] text-[var(--text-muted)]" title={`JPL's track begins after launch; the climb from ${h.launch?.pad ?? 'the pad'} is drawn, not measured`}>ILLUSTRATED ASCENT</span>}
        <button type="button" onClick={controls.close} className={BUTTON} title="Back to now" aria-label="Close the replay"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex flex-wrap items-center gap-1 px-2 pt-1">
        <button type="button" className={BUTTON} onClick={() => prev && controls.seek(prev.jd)} disabled={!prev} title={prev ? `Back to ${prev.label}` : undefined} aria-label="Previous event"><SkipBack className="h-3.5 w-3.5" /></button>
        <button type="button" className={`${BUTTON} text-[var(--text-heading)]`} onClick={state.playing ? controls.pause : controls.play} title={state.playing ? 'Pause' : 'Play'} aria-label={state.playing ? 'Pause' : 'Play'}>
          {state.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button type="button" className={BUTTON} onClick={() => next && controls.seek(next.jd)} disabled={!next} title={next ? `On to ${next.label}` : undefined} aria-label="Next event"><SkipForward className="h-3.5 w-3.5" /></button>
        <select value={state.rate} onChange={e => controls.setRate(Number(e.target.value))} aria-label="Playback speed"
          className="h-7 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[11px] text-[var(--text-primary)] focus:outline-none">
          {RATES.map(r => <option key={r.days} value={r.days} className="bg-[#0b0d12]">{r.label}</option>)}
        </select>
        {slowed && <span className="text-[10px] text-[var(--text-muted)]">slowed to {rateLabel(state.effectiveRate)}{slowedFor ? ` for the ${slowedFor.kind === 'launch' ? 'launch' : `${slowedFor.body.replace(/^./, c => c.toUpperCase())} ${slowedFor.kind}`}` : ''}</span>}
        <button type="button" onClick={() => controls.follow(!state.follow)} aria-pressed={state.follow} title={state.follow ? 'Stand back to see the whole path' : 'Keep the camera on the craft'}
          className={`ml-auto flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors ${state.follow ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]'}`}>
          <Crosshair className="h-3.5 w-3.5" /> Follow
        </button>
      </div>

      <div className="px-3 pb-1 pt-2">
        <div ref={track} role="slider" aria-label="Flight timeline" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(at(jd) * 100)} aria-valuetext={replayDate(jd)} tabIndex={0}
          className="relative h-6 cursor-pointer touch-none select-none"
          onPointerDown={e => { scrubbing.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); seekAt(e.clientX); }}
          onPointerMove={e => { if (scrubbing.current) seekAt(e.clientX); }}
          onPointerUp={() => { scrubbing.current = false; }}
          onKeyDown={e => {
            if (e.key === 'ArrowRight') controls.seek(jd + (model.end - model.start) / 200);
            if (e.key === 'ArrowLeft') controls.seek(jd - (model.end - model.start) / 200);
          }}>
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/10" />
          {h.end > h.fetchedJd && (
            <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-r-full bg-[#7FDBFF]/30" style={{ left: `${at(h.fetchedJd) * 100}%`, right: 0 }} title="JPL's prediction" />
          )}
          <div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-l-full bg-[#F0D060]/80" style={{ width: `${at(jd) * 100}%` }} />
          {h.events.map(e => (
            <button key={`${e.kind}-${e.jd}`} type="button" title={`${e.label} · ${replayDate(e.jd)}`} aria-label={e.label}
              onPointerDown={ev => { ev.stopPropagation(); controls.seek(e.jd); }}
              className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full hover:scale-150"
              style={{ left: `${at(e.jd) * 100}%`, background: EVENT_COLOR[e.kind] }} />
          ))}
          <div className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#F0D060] bg-[#0b0d12]" style={{ left: `${at(jd) * 100}%` }} />
        </div>
        <div className="flex justify-between text-[9px] font-mono tabular-nums text-[var(--text-muted)]">
          <span>{replayDate(model.start).slice(0, 10)}</span>
          <span>{replayDate(model.end).slice(0, 10)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[var(--border-secondary)] px-3 py-2 sm:grid-cols-4">
        <Field label="FROM THE SUN" value={distance(norm(craft))} />
        <Field label="FROM EARTH" value={distance(earthKm)} />
        <Field label="SPEED (SUN)" value={speed(model.speedAt(jd))} />
        <Field label={next ? `NEXT · ${next.label.toUpperCase()}` : 'END OF THE TRACK'} value={next ? `in ${span(next.jd - jd)}` : '—'} />
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div data-hud className="pointer-events-auto w-[min(720px,calc(100vw-32px))] rounded-lg border border-[var(--border-primary)] bg-[var(--bg-panel)] shadow-[0_6px_20px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[8px] font-mono tracking-[0.15em] text-[var(--text-muted)]" title={label}>{label}</div>
      <div className="truncate text-[11px] font-mono tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
