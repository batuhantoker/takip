'use client';

import { Dot } from '@/components/ui/tag';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

interface ViewPresetsProps {
  onNavigate: (lat: number, lng: number, zoom: number) => void;
}

/** `active`: fighting there now, so worth a look. */
const PRESETS = [
  { label: 'Whole world', lat: 20, lng: 0, zoom: 2.5 },
  { label: 'Europe', lat: 48, lng: 10, zoom: 4 },
  { label: 'Middle East', lat: 30, lng: 45, zoom: 4.5, active: true },
  { label: 'Ukraine', lat: 49, lng: 32, zoom: 6, active: true },
  { label: 'Sudan', lat: 15, lng: 30, zoom: 5.5, active: true },
  { label: 'East Asia', lat: 35, lng: 120, zoom: 4 },
  { label: 'Southeast Asia', lat: 10, lng: 110, zoom: 4.5 },
  { label: 'India', lat: 22, lng: 78, zoom: 4.5 },
  { label: 'Africa', lat: 5, lng: 20, zoom: 3.5 },
  { label: 'Americas', lat: 25, lng: -90, zoom: 3 },
  { label: 'Australia', lat: -25, lng: 134, zoom: 4 },
  { label: 'Arctic', lat: 75, lng: 0, zoom: 3.5 },
];

/** Places to jump to: a quiet grid, with a red dot where there is fighting now. */
export default function ViewPresets({ onNavigate }: ViewPresetsProps) {
  return (
    <section aria-labelledby="view-presets-title">
      <h3 id="view-presets-title" className="mb-2 text-meta font-medium text-ink-3">Jump to</h3>
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map(p => (
          <button key={p.label} type="button" onClick={() => onNavigate(p.lat, p.lng, p.zoom)}
            className={cx('flex h-9 items-center gap-2 rounded-control bg-surface-2 px-3 text-left text-body text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION)}>
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            {p.active && <Dot tone="red" label="Active conflict" />}
          </button>
        ))}
      </div>
    </section>
  );
}
