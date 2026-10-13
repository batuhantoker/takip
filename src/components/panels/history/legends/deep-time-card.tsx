'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Property, PropertyList } from '@/components/ui/property-list';
import { Stat } from '@/components/ui/stat';
import type { HistorySession } from '@/lib/history/session';
import { type ClimateFile, climateAt, loadClimate } from '@/lib/paleo/climate';
import { atMa, longMa, maAt, periodAt, sunBrightness } from '@/lib/paleo/deep-time';
import { loadPlateModel, type PlateModel } from '@/lib/paleo/reconstruct';
import { CHAPTERS } from '@/lib/paleo/story';
import ClimateChart from './climate-chart';
import { LegendCard } from './legend-card';
import { Swatch } from '@/components/panels/history/parts/swatch';

const NONE = <span className="text-ink-4" aria-label="no record">—</span>;

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

/** Back, play and forward through the chapters, with one mark per chapter to jump to. */
function ChapterControls({ session }: { session: HistorySession }) {
  const { story } = session;
  const index = story.index() ?? 0;
  return (
    <>
      <IconButton size="sm" label="Previous chapter" icon={ChevronLeft} disabled={index === 0} onClick={() => story.prev()} tooltipSide="top" />
      <IconButton size="sm" label={story.auto() ? 'Pause the story' : 'Play the story'} icon={story.auto() ? Pause : Play}
        onClick={() => story.setAuto(!story.auto())} tooltipSide="top" />
      <IconButton size="sm" label="Next chapter" icon={ChevronRight} disabled={index === CHAPTERS.length - 1} onClick={() => story.next()} tooltipSide="top" />
      <ol className="ml-2 mr-2 flex flex-1 items-center gap-1">
        {CHAPTERS.map((c, i) => (
          <li key={c.title} className="flex-1">
            <button type="button" aria-label={`${c.title}, ${longMa(c.ma)}`} aria-current={i === index ? 'step' : undefined} title={c.title}
              onClick={() => story.go(i)} className={cx('group flex h-6 w-full items-center rounded-[2px]', FOCUS_RING)}>
              <span className={cx(
                'block h-1 w-full rounded-full transition-colors duration-150',
                i === index ? 'bg-ink-1' : i < index ? 'bg-ink-3 group-hover:bg-ink-2' : 'bg-surface-3 group-hover:bg-ink-4',
              )} />
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Over the History timeline in deep time: the age and its world in numbers, or the documentary's open chapter. */
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
  const where = <><Swatch color={period.color} />{period.name} · {period.era}</>;

  return (
    <LegendCard wide
      title={chapter ? chapter.title : longMa(ma)}
      meta={chapter ? `${index! + 1} of ${CHAPTERS.length}` : undefined}
      subtitle={chapter ? <>{story.arrived() ? longMa(chapter.ma) : `${longMa(ma)}, on the way`} · {where}</> : where}
      closeLabel={chapter ? 'Close the story' : 'Back to the calendar'}
      onClose={() => (chapter ? story.close() : session.setDeep(false))}
      source={<>
        {plates.status === 'loading' ? 'Loading the plate model…' : plates.status === 'error' ? "Couldn't load the plate model." : plates.meta.attribution}
        {climate && ` · ${climate.source.attribution}`}
      </>}
      footer={chapter ? <ChapterControls session={session} /> : (
        <>
          <Button size="sm" icon={Play} onClick={() => { story.setAuto(true); story.go(0); }}>Play the story</Button>
          <span className="ml-2 text-meta text-ink-3">{CHAPTERS.length} chapters, 1.8 billion years</span>
        </>
      )}>
      {chapter
        ? <p className="mb-4 text-body text-ink-2">{chapter.body}</p>
        : <p className="mb-4 text-small text-ink-3">Today&apos;s coastlines, carried back on their plates. The seas of the time aren&apos;t drawn.</p>}

      {/* The same three numbers in the same places at every age, so they can be watched changing. */}
      <div className="grid grid-cols-3 gap-3">
        <Stat size="sm" label="Temperature" value={reading ? reading.gmst.mid.toFixed(0) : NONE} unit={reading && '°C'}
          delta={reading && `(${reading.gmst.lo.toFixed(0)}–${reading.gmst.hi.toFixed(0)})`} />
        <Stat size="sm" label="CO₂" value={reading ? Math.round(reading.co2.mid).toLocaleString('en') : NONE} unit={reading && 'ppm'} />
        <Stat size="sm" label="Sunlight" value={String(Math.round(sunBrightness(ma) * 100))} unit="% of today" />
      </div>
      {chapter?.facts && (
        <PropertyList className="mt-2">
          {chapter.facts.map(([label, value]) => <Property key={label} label={label} value={value} />)}
        </PropertyList>
      )}

      {climate && (
        <div className="mt-4">
          {ma <= climate.rows[climate.rows.length - 1][0]
            ? <ClimateChart rows={climate.rows} ma={ma} onSeek={seek} />
            : <p className="text-meta text-ink-3">Temperature and CO₂ records start 485 million years ago.</p>}
        </div>
      )}
    </LegendCard>
  );
}
