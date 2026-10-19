'use client';

import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { useT } from '@/components/ui/use-t';
import { useTemperatureUnit } from '@/components/map/layers/use-temperature-unit';
import { setTemperatureUnit, type TemperatureUnit } from '@/lib/feeds/weather/temperature-unit';

const UNITS: SegmentedOption<TemperatureUnit>[] = [
  { value: 'c', label: '°C' },
  { value: 'f', label: '°F' },
];

/** °C or °F for the temperature labels and readings, under the layer like its sub-filters. */
export function TemperatureUnitToggle() {
  const t = useT();
  const unit = useTemperatureUnit();
  return (
    <div className="mb-2 ml-2 flex items-center justify-between gap-3 border-l border-line py-1 pl-[19px]">
      <span className="text-small text-ink-2">{t('Unit')}</span>
      <Segmented<TemperatureUnit> label={t('Temperature unit')} size="sm" value={unit} onChange={setTemperatureUnit} options={UNITS} />
    </div>
  );
}
