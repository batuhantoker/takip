'use client';

import { Dot } from '@/components/ui/tag';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';

interface ViewPresetsProps {
  onNavigate: (lat: number, lng: number, zoom: number) => void;
}

/** `active`: fighting there now, so worth a look. */
const PRESETS = [
  { label: msg('Whole world'), lat: 20, lng: 0, zoom: 2.5 },
  { label: msg('Europe'), lat: 48, lng: 10, zoom: 4 },
  { label: msg('Middle East'), lat: 30, lng: 45, zoom: 4.5, active: true },
  { label: msg('Ukraine'), lat: 49, lng: 32, zoom: 6, active: true },
  { label: msg('Sudan'), lat: 15, lng: 30, zoom: 5.5, active: true },
  { label: msg('East Asia'), lat: 35, lng: 120, zoom: 4 },
  { label: msg('Southeast Asia'), lat: 10, lng: 110, zoom: 4.5 },
  { label: msg('India'), lat: 22, lng: 78, zoom: 4.5 },
  { label: msg('Africa'), lat: 5, lng: 20, zoom: 3.5 },
  { label: msg('Americas'), lat: 25, lng: -90, zoom: 3 },
  { label: msg('Australia'), lat: -25, lng: 134, zoom: 4 },
  { label: msg('Arctic'), lat: 75, lng: 0, zoom: 3.5 },
];

/** Places to jump to: a quiet grid, with a red dot where there is fighting now. */
export default function ViewPresets({ onNavigate }: ViewPresetsProps) {
  const t = useT();
  return (
    <section aria-labelledby="view-presets-title">
      <h3 id="view-presets-title" className="mb-2 text-meta font-medium text-ink-3">{t('Jump to')}</h3>
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map(p => (
          <button key={p.label} type="button" onClick={() => onNavigate(p.lat, p.lng, p.zoom)}
            className={cx('flex h-9 items-center gap-2 rounded-control bg-surface-2 px-3 text-left text-body text-ink-1 hover:bg-surface-3', FOCUS_RING, TRANSITION)}>
            <span className="min-w-0 flex-1 truncate">{t(p.label)}</span>
            {p.active && <Dot tone="red" label={t('Active conflict')} />}
          </button>
        ))}
      </div>
    </section>
  );
}
