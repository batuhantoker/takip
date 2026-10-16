'use client';

import type { ReactNode } from 'react';
import { Crosshair, Loader2, SkipBack, SkipForward, X } from 'lucide-react';
import { ChoiceMenu, PlayButton, TimeReadout } from '@/components/map/replay/timeline-controls';
import { useTimelineKeys } from '@/components/map/replay/use-timeline-keys';
import { IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Tag } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { norm, sub } from '@/lib/space/astro';
import { distance, speed } from '@/lib/space/format';
import type { Encounter } from '@/lib/space/replay/flight-history';
import { siteNear } from '@/lib/space/craft/landing-sites';
import { isGlobeWorld } from '@/lib/space/worlds';
import { RATES, rateLabel, replayDate, span } from '@/lib/space/replay/format';
import type { ReplayModel } from '@/lib/space/replay/model';
import { wikiTopic } from '@/lib/space/wiki-topic';
import type { ReplayState } from '@/lib/space/scene/craft/flight-replay';
import { useWiki } from '../use-wiki';
import FlightTrack, { flightDate } from './flight-track';

/**
 * The flight replay's controls: play and speed, a timeline marked
 * with the flight's events (launch, flybys, arrivals, today), and where the
 * craft is at the moment shown.
 */

export interface ReplayControls {
  play: () => void;
  pause: () => void;
  seek: (jd: number) => void;
  setRate: (days: number) => void;
  follow: (on: boolean) => void;
  close: () => void;
}

const SPEEDS = [{ options: RATES.map(r => ({ value: r.days, label: r.label.replace('/', ' / ') })) }];

export default function FlightReplayBar({ name, model, state, error, controls }: {
  name: string;
  model: ReplayModel | null;
  state: ReplayState | null;
  error: string | null;
  controls: ReplayControls;
}) {
  const wiki = useWiki(wikiTopic({ kind: 'craft', id: state?.craftId ?? 0 }, name));
  const toggle = () => {
    if (!model || !state) return;
    if (state.playing) controls.pause();
    else controls.play();
  };
  useTimelineKeys(toggle, () => {});

  if (!model || !state) {
    return (
      <Frame>
        <div className="flex items-center gap-2.5 py-2 pr-2 pl-4 text-small text-ink-2">
          {error ? <span className="flex-1">JPL Horizons couldn&apos;t give {name}&apos;s flight: {error}</span> : (
            <>
              <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none" />
              <span className="flex-1">Asking JPL Horizons for {name}&apos;s whole flight. The first time takes up to a minute.</span>
            </>
          )}
          <IconButton label="Close the replay" icon={X} size="sm" tooltipSide="top" onClick={controls.close} />
        </div>
      </Frame>
    );
  }

  const h = model.history;
  const jd = state.jd;
  const craft = model.craftAt(jd);
  const earthKm = norm(sub(craft, model.bodyAt('earth', jd)));
  const predicted = jd > h.fetchedJd;
  const next = h.events.find(e => e.jd > jd + 1e-6);
  const prev = [...h.events].reverse().find(e => e.jd < jd - 1 / 1440);
  const slowed = state.playing && state.effectiveRate < state.rate * 0.99;
  const slowedFor = slowed ? tightest(h.encounters, jd) : null;
  const landing = model.landing && model.landed(jd) ? model.landing : null;
  const site = landing && isGlobeWorld(landing.body) ? siteNear(landing.body, landing.lat, landing.lng) : null;

  return (
    <Frame>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 pr-3 pl-4">
        {wiki?.image ? (
          <a href={wiki.url} target="_blank" rel="noopener noreferrer" title={`${wiki.title} on Wikipedia`} className={cx('size-8 shrink-0 overflow-hidden rounded-control border border-line bg-surface-2', FOCUS_RING)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnail */}
            <img src={wiki.image.src} alt={wiki.title} className="size-full object-cover" />
          </a>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium text-ink-1">{name}</p>
          <p className="truncate text-meta text-ink-3">{wiki?.description ? `Flight replay · ${wiki.description}` : 'Flight replay'}</p>
        </div>
        <dl className="flex shrink-0 items-center gap-5 @max-2xl/flight:order-last @max-2xl/flight:basis-full">
          <Reading label="From the Sun" value={distance(norm(craft))} />
          <Reading label="From Earth" value={distance(earthKm)} />
          <Reading label="Speed relative to the Sun" value={speed(model.speedAt(jd))} />
        </dl>
        <div className="flex shrink-0 items-center gap-1">
          <span aria-hidden className="mr-1 h-5 w-px bg-line @max-2xl/flight:hidden" />
          <Tooltip label={state.follow ? 'Stand back to see the whole path' : 'Keep the camera on the craft'}>
            <button type="button" onClick={() => controls.follow(!state.follow)} aria-pressed={state.follow}
              className={cx('flex h-7 items-center gap-1.5 rounded-control px-2 text-small font-medium', TRANSITION, FOCUS_RING,
                state.follow ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1')}>
              <Crosshair aria-hidden className="size-3.5" strokeWidth={1.75} /> Follow
            </button>
          </Tooltip>
          <IconButton label="Close the replay" icon={X} size="sm" kbd="Esc" tooltipSide="top" onClick={controls.close} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 pr-4 pl-3">
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label={prev ? `Back to ${prev.label}` : 'Previous event'} icon={SkipBack} size="sm" tooltipSide="top" onClick={() => prev && controls.seek(prev.jd)} disabled={!prev} />
          <PlayButton playing={state.playing} onToggle={toggle} />
          <IconButton label={next ? `On to ${next.label}` : 'Next event'} icon={SkipForward} size="sm" tooltipSide="top" onClick={() => next && controls.seek(next.jd)} disabled={!next} />
        </div>
        <TimeReadout className="w-[154px]" primary={flightDate(jd)} secondary={replayDate(jd).slice(11)} />
        <ChoiceMenu label="Speed" value={state.rate} groups={SPEEDS} onChange={controls.setRate} />
        <FlightTrack start={model.start} end={model.end} jd={jd} events={h.events}
          predictedFrom={h.end > h.fetchedJd ? h.fetchedJd : undefined} onSeek={controls.seek} onTogglePlay={toggle} />
      </div>

      <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line px-4 py-2">
        {landing ? (
          <>
            <Tag>Landed{site ? ` · ${site.name}` : ''}</Tag>
            <span className="font-mono text-meta text-ink-2 tabular-nums">{latLng(landing.lat, landing.lng)}</span>
          </>
        ) : next ? (
          <Tag>Next: {next.label} in <span className="font-mono tabular-nums">{span(next.jd - jd)}</span></Tag>
        ) : <Tag>End of the track</Tag>}
        {predicted && <Hint text="Past today, this is JPL's predicted trajectory">Predicted</Hint>}
        {model.ascending(jd) && <Hint text={`JPL's track begins after launch; the climb from ${h.launch?.pad ?? 'the pad'} is drawn, not measured`}>Illustrated ascent</Hint>}
        {slowed && <span className="ml-1 text-meta text-ink-3">Slowed to {rateLabel(state.effectiveRate)}{slowedFor ? ` for the ${slowedFor.kind === 'launch' ? 'launch' : `${slowedFor.body.replace(/^./, c => c.toUpperCase())} ${slowedFor.kind}`}` : ''}</span>}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-hud className="@container/flight pointer-events-auto w-[min(800px,calc(100%-32px))] rounded-float border border-line bg-surface-1 text-ink-2 shadow-float">
      {children}
    </div>
  );
}

/** A quiet tag whose meaning is in its tooltip; focusable so the keyboard can read it too. */
function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip label={text}>
      <span tabIndex={0} className={cx('rounded-[4px]', FOCUS_RING)}>
        <Tag>{children}<span className="sr-only">: {text}</span></Tag>
      </span>
    </Tooltip>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-meta text-ink-3">{label}</dt>
      <dd className="truncate font-mono text-small text-ink-1 tabular-nums">{value}</dd>
    </div>
  );
}

/** The encounter whose finest stretch covers `jd`: the one playback is slowed for. */
function tightest(encounters: Encounter[], jd: number): Encounter | null {
  let best: Encounter | null = null, bestSpan = Infinity;
  for (const e of encounters) for (const t of e.craft) {
    const days = (t.pos.length / 3 - 1) * t.step;
    if (jd >= t.t0 && jd <= t.t0 + days && days < bestSpan) { best = e; bestSpan = days; }
  }
  return best;
}

const latLng = (lat: number, lng: number) => `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lng).toFixed(2)}°${lng < 0 ? 'W' : 'E'}`;
