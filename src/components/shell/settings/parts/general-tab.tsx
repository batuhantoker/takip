'use client';

import { useState } from 'react';
import { windowStore } from '@/components/map/windows';
import { ThemePicker } from '@/components/shell/map-look/map-options';
import { setTheme, useThemeId } from '@/components/shell/map-look/use-theme';
import { Row, Section, SmallButton } from '@/components/site/account/settings/settings-parts';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { useT } from '@/components/ui/use-t';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { useTemperatureUnit } from '@/components/map/layers/use-temperature-unit';
import { setTemperatureUnit, type TemperatureUnit } from '@/lib/feeds/weather/temperature-unit';
import LanguageField from './language-field';
import WikiLanguageField from './wiki-language-field';

const UNITS: SegmentedOption<TemperatureUnit>[] = [{ value: 'c', label: '°C' }, { value: 'f', label: '°F' }];

/** App-wide preferences; each control shares its state with the one already elsewhere. */
export default function GeneralTab() {
  const t = useT();
  const theme = useThemeId();
  const unit = useTemperatureUnit();
  const [reset, setReset] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
      <Section title={t('Language')}>
        <LanguageField />
      </Section>
      <Section title={t('Theme')}>
        <ThemePicker theme={theme} setTheme={setTheme} />
        <p className="text-small text-ink-3">{t('Ghost tints the panels and the map violet.')}</p>
      </Section>
      <Section title={t('Units')}>
        <Row label={t('Temperature')} detail={t('Weather labels and readings')}>
          <Segmented<TemperatureUnit> label={t('Temperature unit')} size="sm" value={unit} onChange={setTemperatureUnit} options={UNITS} />
        </Row>
      </Section>
      <Section title={t('Wikipedia')}>
        <WikiLanguageField />
      </Section>
      {/* Phones show one sheet at a time, so windows have no places there. */}
      {!isMobile && (
        <Section title={t('Windows')}>
          <Row label={t('Window places')} detail={t('Dock every window you moved or resized')}>
            <SmallButton disabled={reset} onClick={() => { windowStore.resetPlaces(); setReset(true); }}>{reset ? t('Done') : t('Reset')}</SmallButton>
          </Row>
        </Section>
      )}
    </>
  );
}
