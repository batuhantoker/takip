'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Landmark, LoaderCircle } from 'lucide-react';
import { cx, ENTER } from '@/components/ui/class-names';
import { FloatingWindow, WindowFoldButton } from '@/components/map/windows';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { Panel, PanelSection } from '@/components/ui/panel';
import { Property, PropertyList } from '@/components/ui/property-list';
import DossierSignals from './dossier-signals';

/* eslint-disable @typescript-eslint/no-explicit-any -- the dossier reply is untyped upstream */
export default function RegionDossier({ regionDossier, dossierLoading, setRegionDossier, setDossierLoading }: {
  regionDossier: any;
  dossierLoading: boolean;
  setRegionDossier: Dispatch<SetStateAction<any>>;
  setDossierLoading: Dispatch<SetStateAction<boolean>>;
}) {
  const close = () => { setRegionDossier(null); setDossierLoading(false); };
  const d = regionDossier;
  const place: string = d?.location?.display_name ?? '';
  const country = d?.country;
  const title = country?.name || place.split(',')[0] || 'This place';
  const isMobile = useIsMobile();

  const panel = (
    <Panel docked={false} title={dossierLoading ? 'Looking up this place' : title} subtitle={dossierLoading ? undefined : place || undefined}
      icon={Landmark} onClose={close} className={isMobile ? 'max-h-[inherit]' : undefined} closeOnEscape={isMobile}
      actions={isMobile ? undefined : <WindowFoldButton />}
      footer={!dossierLoading && d ? <span>Place © OpenStreetMap contributors · facts from Wikidata and Wikipedia</span> : undefined}>
      {dossierLoading ? (
        <div className="flex items-center gap-2 py-6 text-small text-ink-3">
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={1.75} />
          Gathering what is known about it…
        </div>
      ) : d ? (
        <>
          {country && (
            <PanelSection title="Country">
              <PropertyList>
                <Property label="Country" value={`${country.flag ?? ''} ${country.name}`.trim()} mono={false} />
                {country.capital && <Property label="Capital" value={country.capital} mono={false} />}
                {country.population != null && <Property label="Population" value={country.population.toLocaleString()} mono />}
                {(country.subregion || country.region) && <Property label="Region" value={country.subregion || country.region} mono={false} />}
                {!!country.languages?.length && <Property label="Languages" value={country.languages.join(', ')} mono={false} />}
                {country.area != null && <Property label="Area" value={`${country.area.toLocaleString()} km²`} mono />}
                {d.head_of_state && <Property label={d.head_of_state.position || 'Head of state'} value={d.head_of_state.name} mono={false} />}
              </PropertyList>
            </PanelSection>
          )}
          <DossierSignals advice={d.travel_advice} displacement={d.displacement} crime={d.street_crime} unavailable={d.unavailable} />
          {d.wikipedia?.extract && (
            <PanelSection title="From Wikipedia">
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail */}
                {d.wikipedia.thumbnail && <img src={d.wikipedia.thumbnail} alt="" className="size-14 shrink-0 rounded-md object-cover" />}
                <p className="text-small text-ink-2">{d.wikipedia.extract}</p>
              </div>
            </PanelSection>
          )}
        </>
      ) : (
        <p className="py-6 text-small text-ink-3">Nothing came back for this spot. Try a point on land.</p>
      )}
    </Panel>
  );
  if (!isMobile) return <FloatingWindow id="dossier" kind="dossier" label={title} onClose={close}>{panel}</FloatingWindow>;
  return (
    <div className={cx('absolute top-16 right-2 left-2 z-[300]', ENTER)} style={{ maxHeight: 'min(70vh, 640px)' }}>{panel}</div>
  );
}
