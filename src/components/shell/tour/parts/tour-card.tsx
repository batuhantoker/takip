'use client';

import { forwardRef, useId } from 'react';
import { SkipForward, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, ENTER } from '@/components/ui/class-names';
import { Kbd } from '@/components/ui/kbd';
import { ENTER_FROM, type Side } from '@/components/ui/position';
import { useT } from '@/components/ui/use-t';
import { showSettingsTab } from '@/components/shell/settings/open-settings';
import type { Part } from '../lib/measure';
import type { AnyStop } from '../lib/stops';
import { endTour, setTourPart, stepTour } from '../tour-state';

/** The card beside what the tour rings: the stop, or the section of its panel showing. */
export const TourCard = forwardRef<HTMLDivElement, {
  stops: AnyStop[];
  at: number;
  part: number | null;
  parts: Part[];
  side?: Side;
  onNext: () => void;
  onBack: () => void;
}>(function TourCard({ stops, at, part, parts, side, onNext, onBack }, ref) {
  const t = useT();
  const id = useId();
  const stop = stops[at];
  const inside = part !== null;
  const shown = inside && parts.length ? parts[Math.min(part, parts.length - 1)] : null;
  const lastStop = at === stops.length - 1;
  const lastPart = !inside || !parts.length || part >= parts.length - 1;
  const text = (s: string, own: boolean) => (own ? s : t(s));
  const counter = t('{n} of {count}', inside ? { n: Math.min(part, Math.max(parts.length - 1, 0)) + 1, count: parts.length || 1 } : { n: at + 1, count: stops.length });
  // A panel that is open can be scrolled through during the tour; say so.
  const scrollable = !!stop.inside && (inside || !!stop.opens);

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`}
      style={{ visibility: 'hidden' }}
      className={cx('fixed top-0 left-0 z-[1501] w-[320px] rounded-float border border-line bg-surface-1 p-4 shadow-float', ENTER, side && ENTER_FROM[side])}>
      <div className="-mt-1 -mr-2 flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-meta font-medium text-ink-3 tabular-nums">
          {inside ? `${t(stop.title)} · ${counter}` : counter}
        </p>
        {inside && !lastStop && <IconButton size="sm" label={t('Next stop')} icon={SkipForward} onClick={() => stepTour(1)} />}
        <IconButton size="sm" label={t('Stop the tour')} kbd="Esc" icon={X} onClick={endTour} />
      </div>
      <h2 id={`${id}-title`} className="mt-1 flex items-center gap-2 text-title font-semibold text-ink-1">
        {shown ? text(shown.title, shown.own) : t(stop.title)}
        {!inside && stop.kbd && <Kbd>{stop.kbd}</Kbd>}
      </h2>
      <p id={`${id}-body`} className="mt-1.5 text-body text-ink-2">{shown ? text(shown.body, shown.own) : t(stop.body)}</p>
      {!inside && stop.inside && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setTourPart(0)}>{t('Show what’s inside')}</Button>
      )}
      {stop.id === 'layout' && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => { endTour(); showSettingsTab('layout'); }}>{t('Open Layout settings')}</Button>
      )}
      <div className="mt-4 flex items-center gap-1">
        <p className="min-w-0 flex-1 text-meta text-ink-3">{scrollable ? t('Scroll the panel, or press any key') : t('Any key or click goes on')}</p>
        {(at > 0 || inside) && <Button variant="ghost" size="sm" onClick={onBack}>{t('Back')}</Button>}
        <Button variant="primary" size="sm" data-autofocus onClick={onNext}>{lastStop && lastPart ? t('Done') : t('Next')}</Button>
      </div>
    </div>
  );
});
