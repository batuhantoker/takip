'use client';

import { useState } from 'react';
import { Hourglass } from 'lucide-react';
import PanelCard from '@/components/shell/panel-card';
import { HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES } from '@/lib/history-popup';
import { VIEW_GROUPS } from '@/lib/history/country-view';
import type { HistorySession } from '@/lib/history/session';
import { WAR_LAYERS, type WarLayer } from '@/lib/history/war-layers';
import { longMa } from '@/lib/paleo/deep-time';
import { CHAPTERS } from '@/lib/paleo/story';
import IndicatorSearch from './indicator-search';
import { useHistoryTick } from './use-history';

/** What each event family holds, and the years its sources cover. */
const FAMILY_NOTES: Record<string, string> = {
  conflict: 'Wars, battles, sieges and armed conflicts · 3000 BCE–2025',
  terror: 'Terrorist attacks (GTD, non-commercial use) · 1970–2017',
  territorial: 'Territorial claims and changes · 1816–2018',
  heritage: 'World Heritage sites in danger',
  hazard: 'Significant earthquakes, tsunamis and eruptions (NOAA) from 2150 BCE, plus recent USGS quakes',
  politics: 'Treaties, where they were signed, and coups (Wikidata)',
  nuclear: 'Nuclear explosions (SIPRI) · 1945–1998',
};

/** `view` also colours countries by that metric, at `speed` (simulated seconds per second). */
const MOMENTS: { label: string; at: number; view?: string; speed?: number }[] = [
  { label: 'WWI begins', at: Date.UTC(1914, 6, 28) },
  { label: 'WWII begins', at: Date.UTC(1939, 8, 1) },
  { label: 'Korean War', at: Date.UTC(1950, 5, 25) },
  { label: 'Cuban crisis', at: Date.UTC(1962, 9, 16) },
  { label: 'Berlin Wall falls', at: Date.UTC(1989, 10, 9) },
  { label: 'USSR dissolves', at: Date.UTC(1991, 11, 26) },
  { label: '9/11', at: Date.UTC(2001, 8, 11) },
  { label: 'COVID-19 pandemic', at: Date.UTC(2020, 2, 11), view: 'owid:covid_weekly_deaths_pm', speed: 7 * 86_400 },
];

const SECTION = 'text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)] mb-2';
const MORE = '__more';

type FlyTo = (view: WarLayer['view']) => void;

const BUTTON = 'h-7 px-2.5 rounded-md border text-[11.5px]';
const GOLD_BUTTON = `${BUTTON} border-[var(--gold-primary)]/40 text-[var(--gold-light)] hover:bg-[var(--gold-primary)]/10`;
const PLAIN_BUTTON = `${BUTTON} border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gold-primary)]/40`;

/** The plates' story and free play, 1.8 billion years to today. */
function DeepTime({ session }: { session: HistorySession }) {
  const { story } = session;
  const deep = session.deep();
  const open = story.index();
  return (
    <section>
      <h3 className={SECTION}>Deep time</h3>
      <p className="mb-2 text-[11.5px] leading-snug text-[var(--text-muted)]">
        How the continents moved over 1.8 billion years, with Earth&apos;s temperature and CO₂ for the last 485 million.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => { story.setAuto(true); story.go(0); }} className={GOLD_BUTTON}>Play the story</button>
        {deep ? (
          <button type="button" onClick={() => session.setDeep(false)} className={PLAIN_BUTTON}>Back to the calendar</button>
        ) : (
          <button type="button" onClick={() => { session.setDeep(true); session.deepClock.play(); }} className={PLAIN_BUTTON}>Watch the plates move</button>
        )}
      </div>
      <ol className="mt-2 flex flex-col gap-0.5">
        {CHAPTERS.map((c, i) => (
          <li key={c.title}>
            <button type="button" onClick={() => story.go(i)}
              className={`w-full flex items-baseline gap-2 px-2 py-1 rounded-md text-left hover:bg-[var(--hover-accent)] ${i === open ? 'bg-[var(--gold-primary)]/10' : ''}`}>
              <span className={`text-[12px] ${i === open ? 'text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}`}>{c.title}</span>
              <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-[var(--text-muted)]">{longMa(c.ma)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Controls({ session, onFlyTo }: { session: HistorySession; onFlyTo?: FlyTo }) {
  useHistoryTick(session, 1000);
  const [searching, setSearching] = useState(false);
  const families = session.families();
  const view = session.countries;
  const state = view.state();
  const code = state.status === 'off' ? '' : state.code;
  const curated = VIEW_GROUPS.some(g => g.views.some(v => v.code === code));
  const layers = session.layers();
  /** The war from its first month, a month a second, with its battles on; the borders already show the annexations. */
  const play = (war: WarLayer) => {
    session.setLayer(war.code, true);
    session.setFamily('conflict', true);
    session.clock.seek(war.start);
    session.clock.setSpeed(30 * 86_400);
    session.clock.play();
    onFlyTo?.(war.view);
  };

  if (session.deep()) {
    return (
      <div className="p-4 flex flex-col gap-5">
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
          The map shows the plates. Events, borders and country colours come back with the calendar.
        </p>
        <DeepTime session={session} />
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-5">
      <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
        The map follows the timeline at the bottom. Live layers pause until you go back to live.
      </p>

      <section>
        <h3 className={SECTION}>Events</h3>
        <ul className="flex flex-col gap-0.5">
          {Object.entries(HISTORY_FAMILIES).map(([family, f]) => {
            const on = families.includes(family);
            return (
              <li key={family}>
                <label className="flex items-start gap-2.5 px-2 py-1.5 rounded-md hover:bg-[var(--hover-accent)] cursor-pointer">
                  <input type="checkbox" checked={on} onChange={e => session.setFamily(family, e.target.checked)} className="mt-0.5 accent-[var(--gold-primary)]" />
                  <span className="w-2 h-2 mt-1 rounded-full shrink-0" style={{ background: f.color ?? HISTORY_FALLBACK_COLOR }} />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-[var(--text-primary)]">{f.label}</span>
                    {FAMILY_NOTES[family] && <span className="block text-[11px] text-[var(--text-muted)]">{FAMILY_NOTES[family]}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className={SECTION}>Wartime borders</h3>
        {WAR_LAYERS.map(war => (
          <div key={war.code} className="px-2 py-1.5 rounded-md hover:bg-[var(--hover-accent)]">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={layers.includes(war.code)} onChange={e => session.setLayer(war.code, e.target.checked)} className="mt-0.5 accent-[var(--gold-primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-[var(--text-primary)]">{war.label}</span>
                <span className="block text-[11px] text-[var(--text-muted)]">Allies, Axis, occupied and neutral, month by month · {war.years}</span>
              </span>
            </label>
            <button type="button" onClick={() => play(war)}
              className="mt-1.5 ml-6 h-7 px-2.5 rounded-md border border-[var(--gold-primary)]/40 text-[11.5px] text-[var(--gold-light)] hover:bg-[var(--gold-primary)]/10">
              Play {war.years}
            </button>
          </div>
        ))}
        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">Showing borders replaces any country colouring.</p>
      </section>

      <section>
        <h3 className={SECTION}>Colour countries by</h3>
        <select aria-label="Colour countries by" value={searching ? MORE : code}
          onChange={e => {
            if (e.target.value === MORE) setSearching(true);
            else {
              setSearching(false);
              view.select(e.target.value || null);
            }
          }}
          className="w-full h-8 px-2 rounded-md bg-black/40 border border-white/10 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold-primary)]/50">
          <option value="">Nothing</option>
          {VIEW_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.views.map(v => <option key={v.code} value={v.code}>{v.label}</option>)}
            </optgroup>
          ))}
          {code && !curated && <option value={code}>{state.status === 'ready' ? state.data.metric.name : code}</option>}
          <option value={MORE}>Search all indicators…</option>
        </select>
        {searching && <div className="mt-2"><IndicatorSearch view={view} onDone={() => setSearching(false)} /></div>}
        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">From the World Bank (WDI) and Our World in Data, on today&apos;s borders.</p>
      </section>

      <section>
        <h3 className={SECTION}>Go to</h3>
        <div className="flex flex-wrap gap-1.5">
          {MOMENTS.map(m => (
            <button key={m.label} type="button" onClick={() => {
              session.clock.seek(m.at);
              if (m.speed) session.clock.setSpeed(m.speed);
              if (m.view) session.countries.select(m.view);
            }}
              className="h-7 px-2.5 rounded-md border border-white/10 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gold-primary)]/40">
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <DeepTime session={session} />
    </div>
  );
}

/** The History tab: what the historical map shows. The mode itself starts when the tab opens and ends with LIVE. */
export default function HistoryPanel({ session, onOpen, onClose, onFlyTo }: { session: HistorySession | null; onOpen: () => void; onClose: () => void; onFlyTo?: FlyTo }) {
  return (
    <PanelCard title="History" icon={Hourglass} onClose={onClose}>
      {session ? <Controls session={session} onFlyTo={onFlyTo} /> : (
        <div className="p-4">
          <p className="text-[12px] text-[var(--text-secondary)] mb-3">Wars, attacks and country statistics on a timeline back to 1500 and beyond, and the moving continents back 1.8 billion years.</p>
          <button type="button" onClick={onOpen}
            className="h-8 px-3 rounded-md border border-[var(--gold-primary)]/40 text-[12px] text-[var(--gold-light)] hover:bg-[var(--gold-primary)]/10">
            Show history on the map
          </button>
        </div>
      )}
    </PanelCard>
  );
}
