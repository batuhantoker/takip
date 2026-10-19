'use client';

import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Switch } from '@/components/ui/field';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES } from '@/lib/history/popup';
import { formatYear } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { WAR_LAYERS, type WarLayer } from '@/lib/history/war-layers';
import { clockYear, WORLD_BORDERS } from '@/lib/history/world-borders';
import type { Translate } from '@/lib/core/i18n/translator';
import { yearLabel } from '@/lib/map/replay/timeline-ticks';
import { FAMILY_TEXT, type Moment, MOMENTS, type Place } from '@/components/panels/history/lib/history-content';
import { HistoryCard } from './history-card';
import { ToggleRow } from './toggle-row';
import { countAction } from '@/lib/platform/usage-actions';

/** `onArrive` runs once the camera gets there. */
export type FlyTo = (place: Place, onArrive?: () => void) => void;

/** Which event families the map draws. */
export function EventsSection({ session }: { session: HistorySession }) {
  const t = useT();
  const families = session.families();
  const all = Object.entries(HISTORY_FAMILIES);
  return (
    <PanelSection title={t('On the map')} hint={t('{n} of {total}', { n: families.length, total: all.length })}>
      {all.map(([family, f]) => {
        const text = FAMILY_TEXT[family];
        return (
          <ToggleRow key={family} color={f.color ?? HISTORY_FALLBACK_COLOR} title={t(text?.name ?? f.label)}
            span={text && `${formatYear(text.years[0], t)}–${formatYear(text.years[1], t)}`} note={text ? t(text.note) : ''}
            checked={families.includes(family)} onChange={on => session.setFamily(family, on)} />
        );
      })}
      <p className="mt-2 text-meta text-ink-3">{t("Click a point to see what happened and its source. A hollow point's place is approximate.")}</p>
    </PanelSection>
  );
}

/** World borders through the ages, wartime borders month by month, and a way to watch either unfold. */
export function BordersSection({ session, onFlyTo }: { session: HistorySession; onFlyTo?: FlyTo }) {
  const t = useT();
  const layers = session.layers();
  const colouring = session.countries.state().status !== 'off';
  // The war from its first month to its last, a month a second, with its battles on; the borders already show the annexations.
  const play = (war: WarLayer) => {
    countAction('history.jump');
    session.setLayer(war.code, true);
    session.setFamily('conflict', true);
    session.clock.pause();
    session.clock.seek(war.start);
    session.clock.setSpeed(30 * 86_400);
    const start = () => session.clock.play(war.end);
    // The clock waits for the camera, so the first months don't pass mid-flight.
    if (onFlyTo) onFlyTo(war.view, start);
    else start();
  };
  const playWorld = () => {
    countAction('history.jump');
    const w = WORLD_BORDERS;
    session.setLayer(w.code, true);
    session.clock.pause();
    session.clock.seek(w.start);
    session.clock.setSpeed(w.speed);
    const start = () => session.clock.play(w.end);
    if (onFlyTo) onFlyTo(w.view, start);
    else start();
  };
  return (
    <PanelSection title={t('Borders')}>
      <div className="flex flex-col gap-2">
        <HistoryCard title={t(WORLD_BORDERS.label)} body={t('Countries and empires year by year, from 3400 BCE to 2024. Zoomed in, OpenHistoricalMap adds dated borders down to duchies and free cities.')}
          control={<Switch label={t('Show world borders on the map')} hideLabel checked={layers.includes(WORLD_BORDERS.code)} onChange={on => session.setLayer(WORLD_BORDERS.code, on)} />}>
          <Button size="sm" icon={Play} onClick={playWorld}>
            {t('Play {years}', { years: `${formatYear(clockYear(WORLD_BORDERS.start), t)}–${formatYear(clockYear(WORLD_BORDERS.end) - 1, t)}` })}
          </Button>
        </HistoryCard>
        {WAR_LAYERS.map(war => (
          <HistoryCard key={war.code} title={t(war.label)} body={t('Borders and occupation, month by month.')}
            control={<Switch label={t('Show these borders on the map')} hideLabel checked={layers.includes(war.code)} onChange={on => session.setLayer(war.code, on)} />}>
            <Button size="sm" icon={Play} onClick={() => play(war)}>{t('Play {years}', { years: war.years })}</Button>
          </HistoryCard>
        ))}
      </div>
      {colouring && !layers.length && <p className="mt-2 text-meta text-ink-3">{t('Showing borders stops the country colouring.')}</p>}
    </PanelSection>
  );
}

/** "490 BCE", "1914". */
function yearOf(at: number, t: Translate) {
  const y = new Date(at).getUTCFullYear();
  return yearLabel(y > 0 ? y : y - 1, t);
}

function MomentRow({ moment, onGo }: { moment: Moment; onGo: () => void }) {
  const t = useT();
  return (
    <li>
      <button type="button" onClick={onGo}
        className={cx('-mx-2 flex min-h-10 w-[calc(100%+16px)] items-baseline gap-3 rounded-control px-2 py-2.5 text-left hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
        <span className="w-14 shrink-0 text-right font-mono text-small text-ink-3 tabular-nums">{yearOf(moment.at, t)}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium text-ink-1">{t(moment.label)}</span>
          {moment.note && <span className="text-meta text-ink-3">{t(moment.note)}</span>}
        </span>
      </button>
    </li>
  );
}

/** Moments worth starting from: the clock and the map go there together. */
export function MomentsSection({ session, onFlyTo }: { session: HistorySession; onFlyTo?: FlyTo }) {
  const t = useT();
  const go = (m: Moment) => {
    countAction('history.jump');
    m.families?.forEach(f => session.setFamily(f, true));
    session.clock.seek(m.at);
    if (m.speed) session.clock.setSpeed(m.speed);
    if (m.metric) session.countries.select(m.metric);
    onFlyTo?.(m.place);
  };
  return (
    <PanelSection title={t('Jump to')}>
      <ul className="flex flex-col">
        {MOMENTS.map(m => <MomentRow key={m.label} moment={m} onGo={() => go(m)} />)}
      </ul>
    </PanelSection>
  );
}
