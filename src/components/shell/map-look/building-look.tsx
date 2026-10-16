'use client';

import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useBuildingStyle } from '@/components/map/basemap/use-building-style';
import { BUILDING_LOOKS, lookTone, MIN_OPACITY, setBuildingStyle } from '@/lib/map/basemap/buildings';
import { MAP_INK } from '@/lib/map/style/tokens';
import { Slider } from './style-studio-controls';

/** Under the 3D buildings switch: the colour they rise in and how solid they are, live and saved in this browser. */
export function BuildingLook() {
  const s = useBuildingStyle();
  return (
    <div className="my-1 rounded-card bg-surface-2 p-3">
      <div role="group" aria-label="Building colour" className="grid grid-cols-4 gap-1.5">
        {BUILDING_LOOKS.map(l => {
          const on = s.look === l.id;
          // The swatch reads the live accent the way the map does.
          const tone = lookTone(l.id, 'var(--accent)');
          return (
            <button key={l.id} type="button" aria-pressed={on} onClick={() => setBuildingStyle({ look: l.id })}
              className={cx('flex flex-col items-stretch gap-1 rounded-control border p-1 text-meta',
                on ? 'border-line-strong bg-surface-3 text-ink-1' : 'border-transparent text-ink-3 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
              <span aria-hidden className="h-4 rounded-sm" style={{ background: `linear-gradient(to top, ${MAP_INK.surface3}, ${tone})` }} />
              {l.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-small text-ink-2">Opacity</span>
        <Slider label="Building opacity" value={s.opacity} min={MIN_OPACITY} max={1} step={0.05}
          onChange={v => setBuildingStyle({ opacity: v })} format={v => `${Math.round(v * 100)}%`} />
      </div>
    </div>
  );
}
