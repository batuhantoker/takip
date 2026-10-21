'use client';

import { Play } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Disclosure } from '@/components/ui/disclosure';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { useRemembered } from '@/components/map/replay/use-remembered';
import { HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES } from '@/lib/history/popup';
import { formatYear } from '@/lib/history/series';
import type { HistorySession } from '@/lib/history/session';
import { WAR_LAYERS } from '@/lib/history/war-layers';
import { WORLD_BORDERS } from '@/lib/history/world-borders';
import type { Translate } from '@/lib/core/i18n/translator';
import { yearLabel } from '@/lib/map/replay/timeline-ticks';
import { FAMILY_TEXT, type Moment, MOMENTS, WAR_NOTE } from '@/components/panels/history/lib/history-content';
import { type FlyTo, playStory, playWar, playWorldBorders, worldBordersYears } from '@/components/panels/history/lib/history-plays';
import { CountriesSection } from './history-countries-section';
import { KindFilter } from './kind-filter';
import { ToggleRow } from './toggle-row';
import { countAction } from '@/lib/platform/usage-actions';

/** A switch per event family. */
export function FamilyRows({ session }: { session: HistorySession }) {
  const t = useT();
  const families = session.families();
  return Object.entries(HISTORY_FAMILIES).map(([family, f]) => {
    const text = FAMILY_TEXT[family];
    return (
      <ToggleRow key={family} color={f.color ?? HISTORY_FALLBACK_COLOR} title={t(text?.name ?? f.label)}
        span={text && `${formatYear(text.years[0], t)}–${formatYear(text.years[1], t)}`} note={text ? t(text.note) : ''}
        checked={families.includes(family)} onChange={on => session.setFamily(family, on)} />
    );
  });
}

/** While countries are coloured and no borders show, that showing borders stops the colouring. */
function ColouringNote({ session }: { session: HistorySession }) {
  const t = useT();
  if (session.countries.state().status === 'off' || session.layers().length) return null;
  return <p className="mt-2 text-meta text-ink-3">{t('Showing borders stops the country colouring.')}</p>;
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

const PLAY = <Play aria-hidden className="size-4" strokeWidth={1.75} />;
const years = (span: string) => <span className="font-mono text-meta text-ink-3 tabular-nums">{span}</span>;
const FOLDS = ['events', 'borders', 'none'] as const;

/**
 * History in calendar time: what plays first, the map's switches folded away (the open one remembered), then the
 * colours and moments. `closeSheet` makes it a phone's: the sheet hides the map, so whatever sets it moving closes it.
 */
export function CalendarSections({ session, onFlyTo, closeSheet }: { session: HistorySession; onFlyTo?: FlyTo; closeSheet?: () => void }) {
  const t = useT();
  const [open, setOpen] = useRemembered('takip.history.fold', 'none', FOLDS);
  const families = session.families();
  const layers = session.layers();
  const fold = (id: 'events' | 'borders') => ({ open: open === id, onOpenChange: (o: boolean) => setOpen(o ? id : 'none') });
  const onCount = (n: number) => (n ? t('{n} on', { n }) : undefined);
  const borders = [
    { code: WORLD_BORDERS.code, title: t(WORLD_BORDERS.label), span: worldBordersYears(t), note: t('Countries and empires year by year'), play: () => playWorldBorders(session, onFlyTo) },
    ...WAR_LAYERS.map(war => ({ code: war.code, title: t(war.label), span: war.years, note: t(WAR_NOTE), play: () => playWar(session, war, onFlyTo) })),
  ];

  return (
    <>
      <PanelSection title={t('Watch it unfold')}>
        <ul className="flex flex-col">
          <li>
            <ListRow leading={PLAY} title={t('How the continents moved')} subtitle={t('1.8 billion years of drifting plates')}
              onClick={() => { playStory(session); closeSheet?.(); }} />
          </li>
          {borders.map(b => (
            <li key={b.code}><ListRow leading={PLAY} title={b.title} subtitle={b.note} trailing={years(b.span)} onClick={b.play} /></li>
          ))}
        </ul>
      </PanelSection>
      <PanelSection title={t('On the map')}>
        <KindFilter session={session} />
        <Disclosure title={t('Events')} hint={onCount(families.length)} {...fold('events')}>
          <FamilyRows session={session} />
          <p className="mt-2 text-meta text-ink-3">
            {closeSheet
              ? t("Tap a point to see what happened and its source. A hollow point's place is approximate.")
              : t("Click a point to see what happened and its source. A hollow point's place is approximate.")}
          </p>
        </Disclosure>
        <Disclosure title={t('Borders')} hint={onCount(layers.length)} {...fold('borders')}>
          {borders.map(b => (
            <ToggleRow key={b.code} title={b.title} span={b.span} note={b.note} checked={layers.includes(b.code)} onChange={on => session.setLayer(b.code, on)} />
          ))}
          <ColouringNote session={session} />
        </Disclosure>
      </PanelSection>
      <CountriesSection session={session} onPicked={closeSheet} />
      <MomentsSection session={session} onFlyTo={onFlyTo} />
    </>
  );
}
