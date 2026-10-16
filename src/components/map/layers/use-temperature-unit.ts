'use client';

import { useSyncExternalStore } from 'react';
import { getTemperatureUnit, subscribeTemperatureUnit } from '@/lib/feeds/weather/temperature-unit';

export const useTemperatureUnit = () => useSyncExternalStore(subscribeTemperatureUnit, getTemperatureUnit, () => 'c' as const);
