'use client';

import { useId, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Map as MapIcon, Moon, Mountain, Satellite } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { cx, FOCUS_RING, TRANSITION, type IconType } from '@/components/ui/class-names';
import type { MapStyle } from '@/components/shell/state/types';
import StyleStudio from '@/components/shell/map-look/style-studio';
import { countAction } from '@/lib/platform/usage-actions';
import { ClusterButton } from './cluster-button';

// One real tile of the Alps from each look, so the choice is a picture rather than a word.
const STYLES: { id: MapStyle; label: string; note: string; icon: IconType; thumb: string }[] = [
  { id: 'dark', label: 'Dark', note: 'Quiet streets and labels', icon: Moon,
    thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/4/5/8' },
  { id: 'satellite', label: 'Satellite', note: 'Esri imagery', icon: Satellite,
    thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/5/8' },
  { id: 'topo', label: 'Topo', note: 'Relief and trails', icon: Mountain,
    thumb: 'https://a.tile.opentopomap.org/4/8/5.png' },
];

function Swatch({ style, on, onPick }: { style: (typeof STYLES)[number]; on: boolean; onPick: () => void }) {
  const Icon = style.icon;
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} title={style.note}
      className={cx('group flex min-w-0 flex-col gap-1.5 rounded-card text-left', FOCUS_RING)}>
      <span className={cx(
        'relative flex h-14 w-full items-center justify-center overflow-hidden rounded-card border bg-surface-2 text-ink-3',
        on ? 'border-accent ring-1 ring-accent' : 'border-line group-hover:border-line-strong',
        TRANSITION,
      )}>
        {/* Shows only if the tile cannot load. */}
        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
        {/* eslint-disable-next-line @next/next/no-img-element -- a remote tile; next.config allows no remote images by design */}
        <img src={style.thumb} alt="" loading="lazy" draggable={false}
          onError={e => { e.currentTarget.hidden = true; }}
          className="absolute inset-0 size-full object-cover" />
      </span>
      <span className={cx('truncate px-0.5 text-small font-medium', on ? 'text-ink-1' : 'text-ink-2 group-hover:text-ink-1', TRANSITION)}>
        {style.label}
      </span>
    </button>
  );
}

/** Dark, Satellite or Topo, as pictures. Also offered in Settings. */
export function BaseMapPicker({ mapStyle, setMapStyle, labelledBy }: {
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
  labelledBy?: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : 'Base map'} className="grid grid-cols-3 gap-2">
      {STYLES.map(s => <Swatch key={s.id} style={s} on={s.id === mapStyle} onPick={() => { countAction('basemap.change'); setMapStyle(s.id); }} />)}
    </div>
  );
}

/**
 * The base map: three big choices, and under them how the map is drawn
 * (day and night, 3D, theme, tile provider), which `options` brings.
 */
export function BaseMapButton({ mapStyle, setMapStyle, options, touch }: {
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
  /** Rendered under the swatches; given `openStudio` to hand over to the Style Studio. */
  options?: (openStudio: () => void, close: () => void) => ReactNode;
  touch: boolean;
}) {
  const [studio, setStudio] = useState(false);
  const labelId = useId();
  return (
    <>
      <Popover label="Base map and options" placement="left" align="end" className="w-[296px] p-3"
        trigger={<ClusterButton label="Base map and options" touch={touch}><MapIcon aria-hidden className="size-4" strokeWidth={1.75} /></ClusterButton>}>
        {close => (
          <>
            <p id={labelId} className="mb-2 text-meta font-medium text-ink-3">Base map</p>
            <BaseMapPicker mapStyle={mapStyle} setMapStyle={setMapStyle} labelledBy={labelId} />
            {options?.(() => { close(); setStudio(true); }, close)}
          </>
        )}
      </Popover>
      {studio && <StyleStudio onClose={() => setStudio(false)} />}
    </>
  );
}
