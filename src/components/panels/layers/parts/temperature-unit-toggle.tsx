'use client';

import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { setTemperatureUnit, useTemperatureUnit, type TemperatureUnit } from '@/lib/weather/temperature-unit';

const UNITS: SegmentedOption<TemperatureUnit>[] = [
  { value: 'c', label: '°C' },
  { value: 'f', label: '°F' },
];

/** °C or °F for the temperature labels and readings, under the layer like its sub-filters. */
export function TemperatureUnitToggle() {
  const unit = useTemperatureUnit();
  return (
    <div className="mb-2 ml-2 flex items-center justify-between gap-3 border-l border-line py-1 pl-[19px]">
      <span className="text-small text-ink-2">Unit</span>
      <Segmented<TemperatureUnit> label="Temperature unit" size="sm" value={unit} onChange={setTemperatureUnit} options={UNITS} />
    </div>
  );
}
