'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import type { HistorySession } from '@/lib/history/session';
import { type ClimateFile, climateAt, loadClimate } from '@/lib/paleo/climate';
import { atMa, longMa, maAt, periodAt, sunBrightness } from '@/lib/paleo/deep-time';
import { loadPlateModel, type PlateModel } from '@/lib/paleo/reconstruct';
import { CHAPTERS } from '@/lib/paleo/story';
import ClimateChart from './climate-chart';

type Plates = { status: 'loading' } | { status: 'ready'; meta: PlateModel['meta'] } | { status: 'error' };

function useDeepData() {
  const [plates, setPlates] = useState<Plates>({ status: 'loading' });
  const [climate, setClimate] = useState<ClimateFile | null>(null);
  useEffect(() => {
    let live = true;
    loadPlateModel().then(m => live && setPlates({ status: 'ready', meta: m.meta }), () => live && setPlates({ status: 'error' }));
    loadClimate().then(c => live && setClimate(c), () => {});
    return () => { live = false; };
  }, []);
  return { plates, climate };
}

const CHIP = 'px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]';
const ICON_BUTTON = 'w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--hover-accent)] disabled:opacity-30 disabled:hover:bg-transparent';

function Chip({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={CHIP}>
      <div className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</div>
      <div className="text-[12px] text-[var(--text-primary)] tabular-nums">{value}{note && <span className="text-[10.5px] text-[var(--text-muted)]"> {note}</span>}</div>
    </div>
  );
}

/** Above the History bar in deep time: the age and its world in numbers, or the documentary's open chapter. */
export default function DeepTimeCard({ session }: { session: HistorySession }) {
  const { plates, climate } = useDeepData();
  const { story, deepClock } = session;
  const ma = maAt(deepClock.time());
  const period = periodAt(ma);
  const reading = climate ? climateAt(climate.rows, ma) : null;
  const index = story.index();
  const chapter = index === null ? null : CHAPTERS[index];
  const seek = (to: number) => {
    story.hold();
    deepClock.seek(atMa(to));
  };

  const chips = (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {reading && <Chip label="Global temperature" value={`${reading.gmst.mid.toFixed(0)} °C`} note={`(${reading.gmst.lo.toFixed(0)}–${reading.gmst.hi.toFixed(0)})`} />}
      {reading && <Chip label="CO₂" value={`${Math.round(reading.co2.mid).toLocaleString('en')} ppm`} />}
      <Chip label="Sun" value={`${Math.round(sunBrightness(ma) * 100)}%`} note="of today's light" />
      {chapter?.facts?.map(([label, value]) => <Chip key={label} label={label} value={value} />)}
    </div>
  );

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[400px] max-w-[calc(100vw-32px)] px-3.5 py-3 rounded-lg bg-[var(--bg-panel)] border border-white/[0.08] backdrop-blur-xl shadow-lg font-sans text-[var(--text-secondary)]">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: period.color }} />
        <span className="text-[11px] text-[var(--text-primary)]">{period.name}</span>
        <span className="text-[11px] text-[var(--text-muted)]">· {period.era}</span>
        {chapter && <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Chapter {index! + 1} of {CHAPTERS.length}</span>}
        <button type="button" aria-label={chapter ? 'Close the story' : 'Back to the calendar'} title={chapter ? 'Close the story' : 'Back to the calendar'}
          onClick={() => (chapter ? story.close() : session.setDeep(false))}
          className={`${chapter ? '' : 'ml-auto'} w-5 h-5 -mr-1 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)]`}>
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {chapter ? (
        <>
          <h3 className="mt-2 text-[16px] font-medium leading-snug text-[var(--gold-light)]">{chapter.title}</h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            {story.arrived() ? longMa(chapter.ma) : `${longMa(ma)} · on the way to ${longMa(chapter.ma)}`}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-primary)]">{chapter.body}</p>
        </>
      ) : (
        <p className="mt-1.5 text-[18px] font-medium text-[var(--text-primary)]">{longMa(ma)}</p>
      )}

      {chips}
      {climate && (ma <= climate.rows[climate.rows.length - 1][0]
        ? <ClimateChart rows={climate.rows} ma={ma} onSeek={seek} />
        : <p className="mt-2 text-[10.5px] text-[var(--text-muted)]">The temperature record starts 485 million years ago.</p>)}

      {chapter ? (
        <div className="mt-2.5 flex items-center gap-1">
          <button type="button" aria-label="Previous chapter" disabled={index === 0} onClick={() => story.prev()} className={ICON_BUTTON}>
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button type="button" aria-label={story.auto() ? 'Pause the story' : 'Play the story'} onClick={() => story.setAuto(!story.auto())} className={ICON_BUTTON}>
            {story.auto() ? <Pause className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Play className="w-3.5 h-3.5" strokeWidth={1.5} />}
          </button>
          <button type="button" aria-label="Next chapter" disabled={index === CHAPTERS.length - 1} onClick={() => story.next()} className={ICON_BUTTON}>
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <div className="ml-2 flex flex-1 items-center gap-1">
            {CHAPTERS.map((c, i) => (
              <button key={c.title} type="button" aria-label={c.title} title={`${c.title} · ${longMa(c.ma)}`} onClick={() => story.go(i)}
                className="group flex-1 h-4 flex items-center">
                <span className={`block w-full h-1 rounded-full ${i === index ? 'bg-[var(--gold-light)]' : i < index! ? 'bg-[var(--gold-primary)]/50' : 'bg-white/15'} group-hover:bg-[var(--gold-light)]/80`} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-3">
          <button type="button" onClick={() => { story.setAuto(true); story.go(0); }}
            className="h-7 px-3 rounded-md border border-[var(--gold-primary)]/40 text-[11.5px] text-[var(--gold-light)] hover:bg-[var(--gold-primary)]/10 flex items-center gap-1.5 shrink-0">
            <Play className="w-3 h-3" strokeWidth={1.5} />Play the story
          </button>
          <p className="text-[10.5px] leading-snug text-[var(--text-muted)]">Today&apos;s coastlines carried back on their plates; the seas of the time aren&apos;t drawn.</p>
        </div>
      )}

      <p className="mt-2 text-[9.5px] text-[var(--text-muted)] truncate">
        {plates.status === 'loading' ? 'Loading the plate model…' : plates.status === 'error' ? "Couldn't load the plate model." : plates.meta.attribution}
        {climate && ` · ${climate.source.attribution}`}
      </p>
    </div>
  );
}
