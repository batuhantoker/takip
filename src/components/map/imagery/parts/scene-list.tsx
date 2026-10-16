'use client';

import { Download } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Button } from '@/components/ui/button';
import { PanelSection } from '@/components/ui/panel';
import type { ScenePass } from '@/lib/feeds/imagery/passes';
import type { ImagerElements } from '@/lib/feeds/imagery/scene-search';
import { coords } from '@/components/map/inspect/format';
import type { SaveState } from '../hooks/use-save-image';
import { daysAgo, kindLabel, shortDate, utcTime } from '../lib/format';

const SHOWN = 20;

/** Where the selected pass's satellite is now. */
function SatelliteNow({ pass, sat, onShow }: { pass: ScenePass; sat: ImagerElements | undefined; onShow: (sat: ImagerElements) => void }) {
  const imager = pass.lead.imager;
  if (!imager) return null;
  if (!sat) return <p className="mt-1 text-meta text-ink-3">Its position couldn&apos;t be loaded.</p>;
  return (
    <p className="mt-1 text-meta text-ink-3">
      {imager.name} is now over <span className="font-mono">{coords(sat.lat, sat.lng)}</span>, <span className="font-mono">{Math.round(sat.altKm)} km</span> up · its orbit ahead is dashed on the map
      <Button variant="ghost" size="sm" className="mt-1" onClick={() => onShow(sat)}>Show where it is</Button>
    </p>
  );
}

function SaveButton({ pass, save, onSave }: { pass: ScenePass; save: SaveState; onSave: (pass: ScenePass) => void }) {
  const mine = save.status !== 'idle' && save.id === pass.id;
  const saving = mine && save.status === 'saving';
  const note = !mine ? null
    : save.status === 'saving' ? `${Math.round((save.done / save.total) * 100)}%`
      : save.status === 'failed' ? 'Couldn’t make the image.'
        : save.missing ? 'Saved, with gaps where Planetary Computer didn’t answer.' : 'Saved.';
  return (
    <div className="mt-1 flex items-center gap-2">
      <Button variant="ghost" size="sm" icon={Download} loading={saving} disabled={saving} onClick={() => onSave(pass)}>Save image of the area</Button>
      {note && <span className="text-meta text-ink-3" aria-live="polite">{note}</span>}
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Row({ pass, on, now, onSelect }: { pass: ScenePass; on: boolean; now: number; onSelect: () => void }) {
  const { lead } = pass;
  const partial = pass.coverage < 0.95;
  return (
    <button type="button" aria-pressed={on} onClick={onSelect}
      className={cx('flex w-full items-center gap-3 rounded-control p-1.5 text-left', on ? 'bg-surface-3' : 'hover:bg-surface-2', FOCUS_RING, TRANSITION)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Planetary Computer */}
      {lead.preview ? <img src={lead.preview} alt="" loading="lazy" className="size-11 shrink-0 rounded-md bg-surface-2 object-cover" /> : <span className="size-11 shrink-0 rounded-md bg-surface-2" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small text-ink-1">
          {pass.mix ? <>Clearest mix <span className="text-ink-3">{pass.mix.passes} passes</span></>
            : <>{lead.imager?.name ?? lead.platform} {lead.imager && <span className="text-ink-3">{kindLabel(lead.imager)}</span>}</>}
        </span>
        <span className="block truncate text-meta text-ink-3">
          {pass.mix ? <span className="font-mono">{shortDate(pass.mix.from)} – {shortDate(pass.mix.to)}</span>
            : <><span className="font-mono">{utcTime(lead.time)}</span> · {daysAgo(lead.time, now)}</>}
          {pass.cloud != null && <> · cloud <span className="font-mono">{Math.round(pass.cloud)}%</span></>}
          {partial && <> · covers <span className="font-mono">{pct(pass.coverage)}</span></>}
        </span>
      </span>
    </button>
  );
}

/** The passes over the area, newest first, with the clearest mix on top; picking one draws it on the map. */
export function SceneList({ passes, mix, days, selected, onSelect, onShowSatellite, elements, now, save, onSave }: {
  passes: ScenePass[];
  mix: ScenePass | null;
  /** How far back the list reaches. */
  days: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onShowSatellite: (sat: ImagerElements) => void;
  elements: Map<string, ImagerElements>;
  now: number;
  save: SaveState;
  onSave: (pass: ScenePass) => void;
}) {
  const rows = passes.slice(0, SHOWN);
  const item = (pass: ScenePass) => {
    const on = pass.id === selected;
    return (
      <li key={pass.id}>
        <Row pass={pass} on={on} now={now} onSelect={() => onSelect(on ? null : pass.id)} />
        {on && (
          <div className="px-1.5 pb-1">
            {pass.mix
              ? <p className="mt-1 text-meta text-ink-3">The clearest picture of each part of the area from the last {days} days, so the dates differ across it.</p>
              : <SatelliteNow pass={pass} sat={pass.lead.imager ? elements.get(pass.lead.imager.norad) : undefined} onShow={onShowSatellite} />}
            <SaveButton pass={pass} save={save} onSave={onSave} />
          </div>
        )}
      </li>
    );
  };
  return (
    <PanelSection title="Recent images" hint={`last ${days} days · ${passes.length} passes · times UTC`}>
      {passes.length === 0 ? (
        <p className="text-small text-ink-3">No images of this area in the last {days} days.</p>
      ) : (
        <>
          {mix && (
            <ul className="mb-2 flex flex-col gap-1 border-b border-line pb-2">
              {item(mix)}
            </ul>
          )}
          <ul className="flex flex-col gap-1">{rows.map(item)}</ul>
          {passes.length > SHOWN && (
            <p className="mt-2 text-meta text-ink-3">The newest {SHOWN} of {passes.length} passes.</p>
          )}
        </>
      )}
    </PanelSection>
  );
}
