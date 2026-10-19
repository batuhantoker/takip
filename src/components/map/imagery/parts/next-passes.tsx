'use client';

import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import type { UpcomingPass } from '../hooks/use-imagery-data';
import { countdown, kindLabel, utcStamp } from '../lib/format';

/** When the imaging satellites next fly over: an overflight, not a promised image. */
export function NextPasses({ passes, now }: { passes: UpcomingPass[]; now: number }) {
  const t = useT();
  return (
    <PanelSection title={t('Next passes over the area')} hint={t("overflights; an image isn't promised")}>
      {passes.length === 0 ? (
        <p className="text-small text-ink-3">{t("No pass in the next six days, or the orbits couldn't be loaded.")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {passes.map(p => (
            <li key={`${p.imager.norad}-${p.time}`} className="flex items-baseline justify-between gap-3 text-small">
              <span className="min-w-0 truncate text-ink-1">{p.imager.name} <span className="text-ink-3">{kindLabel(p.imager, t)}</span></span>
              <span className="shrink-0 font-mono text-meta text-ink-2" title={utcStamp(p.time, t.intl)}>{countdown(p.time, now, t)}</span>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
