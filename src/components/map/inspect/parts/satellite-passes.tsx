'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crosshair, Eye } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { PanelSection } from '@/components/ui/panel';
import { Property, PropertyList } from '@/components/ui/property-list';
import { useT } from '@/components/ui/use-t';
import { parseTLE } from '@/lib/feeds/satellites/orbit';
import { compassPoint, nextSkyPasses } from '@/lib/feeds/satellites/pass';
import type { MapRef } from '@/components/map/types';
import { Note } from './inspect-card';
import { usePlaceName } from '../use-place-name';

const HOURS = 48;
const when = (ms: number, locale: string) => new Date(ms).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
const hhmm = (ms: number, locale: string) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

/**
 * When the satellite next crosses the sky over a place: the map centre when the card opened, or the
 * view's centre on request. Visible means sunlit against a dark sky, so it can be seen by eye.
 */
export function SatellitePasses({ line1, line2, mapRef }: { line1: string; line2: string; mapRef: MapRef }) {
  const t = useT();
  const [observer, setObserver] = useState<{ lat: number; lng: number } | null>(null);
  const takeCentre = useCallback(() => {
    const c = mapRef.current?.getCenter();
    if (c) setObserver({ lat: c.lat, lng: c.lng });
  }, [mapRef]);
  // The map centre when the card opens; the map is outside React, so it is read once mounted.
  useEffect(() => { takeCentre(); }, [takeCentre]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const place = usePlaceName(observer?.lat ?? null, observer?.lng ?? null);

  // Recomputed every five minutes, so a pass that has ended drops off.
  const bucket = Math.floor(now / 300_000);
  const passes = useMemo(() => {
    const satrec = parseTLE(line1, line2);
    return satrec && observer ? nextSkyPasses(satrec, observer.lat, observer.lng, bucket * 300_000, { hours: HOURS, max: 4 }) : [];
  }, [line1, line2, observer, bucket]);

  if (!observer) return null;
  const over = place && !place.sea ? place.name : `${Math.abs(observer.lat).toFixed(1)}°${observer.lat >= 0 ? 'N' : 'S'} ${Math.abs(observer.lng).toFixed(1)}°${observer.lng >= 0 ? 'E' : 'W'}`;
  const always = passes.length === 1 && passes[0].set == null && passes[0].rise === bucket * 300_000;

  return (
    <PanelSection
      title={t('Next passes')}
      action={<IconButton size="sm" icon={Crosshair} label={t('Passes over the middle of the map')} tooltipSide="left" onClick={takeCentre} />}
    >
      <Note>{t('Over {place}, above 10° of sky', { place: over })}</Note>
      {always ? (
        <PropertyList className="mt-1">
          <Property label={t('Always up')} value={t('{deg}° high, to the {dir}', { deg: Math.round(passes[0].maxElevation), dir: compassPoint(passes[0].riseAzimuth) })} />
        </PropertyList>
      ) : passes.length ? (
        <PropertyList className="mt-1">
          {passes.map(p => (
            <Property
              key={p.rise}
              label={<span className="font-mono tabular-nums">{when(p.rise, t.intl)}{p.set ? `–${hhmm(p.set, t.intl)}` : ''}</span>}
              value={<span className="inline-flex items-center gap-1.5">
                {p.visible && <Eye aria-label={t('Visible by eye')} className="size-3.5 text-ink-2" strokeWidth={1.75} />}
                {t('{deg}° · {from} to {to}', { deg: Math.round(p.maxElevation), from: compassPoint(p.riseAzimuth), to: p.setAzimuth == null ? '…' : compassPoint(p.setAzimuth) })}
              </span>}
              mono
            />
          ))}
        </PropertyList>
      ) : (
        <Note>{t('None in the next two days')}</Note>
      )}
    </PanelSection>
  );
}
