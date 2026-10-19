'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Palette } from 'lucide-react';
import { BaseMapPicker } from '@/components/map/controls/base-map-button';
import { DisplaySwitches, TilesPicker, type DisplayProps } from '@/components/shell/map-look/map-options';
import type { MapStyle } from '@/components/shell/state/types';
import { Row, Section, SmallButton } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';

/** The page's own map state, so these controls and the map's base map popover move together. */
export type MapSettings = DisplayProps & {
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
};

/** The base map popover's controls again; each one changes the map at once. */
export default function MapTab({ map, onOpenStudio }: { map?: MapSettings; onOpenStudio: () => void }) {
  const t = useT();
  return (
    <>
      {map && (
        <Section title={t('Base map')}>
          <BaseMapPicker mapStyle={map.mapStyle} setMapStyle={map.setMapStyle} />
        </Section>
      )}
      <Section title={t('Map tiles')}>
        <div><TilesPicker /></div>
      </Section>
      {map && (
        <Section title={t('Display')}>
          <DisplaySwitches {...map} />
        </Section>
      )}
      <Section title={t('Style studio')}>
        <Row label={t('Colours, type and motion')} detail={t('Live on the map, saved in this browser')}>
          <SmallButton onClick={onOpenStudio}><Palette aria-hidden className="size-3.5" strokeWidth={1.75} />{t('Open')}</SmallButton>
        </Row>
      </Section>
    </>
  );
}
