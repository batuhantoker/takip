'use client';

import { useState } from 'react';
import { Hourglass } from 'lucide-react';
import PanelCard from '@/components/shell/panel-card';
import { HISTORY_FALLBACK_COLOR, HISTORY_FAMILIES } from '@/lib/history-popup';
import { VIEW_GROUPS } from '@/lib/history/country-view';
import type { HistorySession } from '@/lib/history/session';
import IndicatorSearch from './indicator-search';
import { useHistoryTick } from './use-history';

/** What each event family holds, and the years its sources cover. */
const FAMILY_NOTES: Record<string, string> = {
  conflict: 'Wars, battles and armed conflicts · 1816–2025',
  terror: 'Terrorist attacks (GTD, non-commercial use) · 1970–2017',
  territorial: 'Territorial claims and changes · 1816–2018',
  econ: 'Tariffs of the trade war · 2018–2025',
  heritage: 'World Heritage sites in danger',
  hazard: 'Earthquakes recorded from USGS',
};

const MOMENTS = [
  { label: 'WWI begins', at: Date.UTC(1914, 6, 28) },
  { label: 'WWII begins', at: Date.UTC(1939, 8, 1) },
  { label: 'Korean War', at: Date.UTC(1950, 5, 25) },
  { label: 'Cuban crisis', at: Date.UTC(1962, 9, 16) },
  { label: 'Berlin Wall falls', at: Date.UTC(1989, 10, 9) },
  { label: 'USSR dissolves', at: Date.UTC(1991, 11, 26) },
  { label: '9/11', at: Date.UTC(2001, 8, 11) },
];

const SECTION = 'text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)] mb-2';
const MORE = '__more';

function Controls({ session }: { session: HistorySession }) {
  useHistoryTick(session, 1000);
  const [searching, setSearching] = useState(false);
  const families = session.families();
  const view = session.countries;
  const state = view.state();
  const code = state.status === 'off' ? '' : state.code;
  const curated = VIEW_GROUPS.some(g => g.views.some(v => v.code === code));

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
            <button key={m.label} type="button" onClick={() => session.clock.seek(m.at)}
              className="h-7 px-2.5 rounded-md border border-white/10 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gold-primary)]/40">
              {m.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** The History tab: what the historical map shows. The mode itself starts when the tab opens and ends with LIVE. */
export default function HistoryPanel({ session, onOpen, onClose }: { session: HistorySession | null; onOpen: () => void; onClose: () => void }) {
  return (
    <PanelCard title="History" icon={Hourglass} onClose={onClose}>
      {session ? <Controls session={session} /> : (
        <div className="p-4">
          <p className="text-[12px] text-[var(--text-secondary)] mb-3">Wars, attacks and country statistics on a timeline back to 1500 and beyond.</p>
          <button type="button" onClick={onOpen}
            className="h-8 px-3 rounded-md border border-[var(--gold-primary)]/40 text-[12px] text-[var(--gold-light)] hover:bg-[var(--gold-primary)]/10">
            Show history on the map
          </button>
        </div>
      )}
    </PanelCard>
  );
}
