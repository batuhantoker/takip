'use client';

import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Switch } from '@/components/ui/field';
import { PanelSection } from '@/components/ui/panel';
import { HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES } from '@/lib/history/popup';
import type { HistorySession } from '@/lib/history/session';
import { WAR_LAYERS, type WarLayer } from '@/lib/history/war-layers';
import { yearLabel } from '@/lib/replay/timeline-ticks';
import { FAMILY_TEXT, type Moment, MOMENTS, type Place } from '@/components/panels/history/lib/history-content';
import { HistoryCard } from './history-card';
import { ToggleRow } from './toggle-row';

export type FlyTo = (place: Place) => void;

/** Which event families the map draws. */
export function EventsSection({ session }: { session: HistorySession }) {
  const families = session.families();
  const all = Object.entries(HISTORY_FAMILIES);
  return (
    <PanelSection title="On the map" hint={`${families.length} of ${all.length}`}>
      {all.map(([family, f]) => {
        const text = FAMILY_TEXT[family];
        return (
          <ToggleRow key={family} color={f.color ?? HISTORY_FALLBACK_COLOR} title={text?.name ?? f.label} span={text?.span} note={text?.note ?? ''}
            checked={families.includes(family)} onChange={on => session.setFamily(family, on)} />
        );
      })}
      <p className="mt-2 text-meta text-ink-3">Click a point to see what happened and its source. A hollow point&apos;s place is approximate.</p>
    </PanelSection>
  );
}

/** Wartime borders, month by month, and a way to watch the war unfold. */
export function BordersSection({ session, onFlyTo }: { session: HistorySession; onFlyTo?: FlyTo }) {
  const layers = session.layers();
  const colouring = session.countries.state().status !== 'off';
  // The war from its first month, a month a second, with its battles on; the borders already show the annexations.
  const play = (war: WarLayer) => {
    session.setLayer(war.code, true);
    session.setFamily('conflict', true);
    session.clock.seek(war.start);
    session.clock.setSpeed(30 * 86_400);
    session.clock.play();
    onFlyTo?.(war.view);
  };
  return (
    <PanelSection title="Borders">
      <div className="flex flex-col gap-2">
        {WAR_LAYERS.map(war => (
          <HistoryCard key={war.code} title={war.label} body="Borders and occupation, month by month."
            control={<Switch label="Show these borders on the map" hideLabel checked={layers.includes(war.code)} onChange={on => session.setLayer(war.code, on)} />}>
            <Button size="sm" icon={Play} onClick={() => play(war)}>Play {war.years}</Button>
          </HistoryCard>
        ))}
      </div>
      {colouring && !layers.length && <p className="mt-2 text-meta text-ink-3">Showing borders stops the country colouring.</p>}
    </PanelSection>
  );
}

/** "490 BCE", "1914". */
function yearOf(t: number) {
  const y = new Date(t).getUTCFullYear();
  return yearLabel(y > 0 ? y : y - 1);
}

function MomentRow({ moment, onGo }: { moment: Moment; onGo: () => void }) {
  return (
    <li>
      <button type="button" onClick={onGo}
        className={cx('-mx-2 flex min-h-10 w-[calc(100%+16px)] items-baseline gap-3 rounded-control px-2 py-2.5 text-left hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
        <span className="w-14 shrink-0 text-right font-mono text-small text-ink-3 tabular-nums">{yearOf(moment.at)}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium text-ink-1">{moment.label}</span>
          {moment.note && <span className="text-meta text-ink-3">{moment.note}</span>}
        </span>
      </button>
    </li>
  );
}

/** Moments worth starting from: the clock and the map go there together. */
export function MomentsSection({ session, onFlyTo }: { session: HistorySession; onFlyTo?: FlyTo }) {
  const go = (m: Moment) => {
    m.families?.forEach(f => session.setFamily(f, true));
    session.clock.seek(m.at);
    if (m.speed) session.clock.setSpeed(m.speed);
    if (m.metric) session.countries.select(m.metric);
    onFlyTo?.(m.place);
  };
  return (
    <PanelSection title="Jump to">
      <ul className="flex flex-col">
        {MOMENTS.map(m => <MomentRow key={m.label} moment={m} onGo={() => go(m)} />)}
      </ul>
    </PanelSection>
  );
}
