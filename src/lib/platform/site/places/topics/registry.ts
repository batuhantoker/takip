import type { PlaceTopic } from '../topic';
import { CAMERAS } from './cameras';
import { FLIGHTS } from './flights';
import { TRANSIT } from './transit';
import { WEATHER } from './weather';

/** Every place topic, in the order a place's overview lists them. Each one's body is in components/site/places/topics. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each topic has its own data and live types
export const TOPICS: readonly PlaceTopic<any, any>[] = [TRANSIT, CAMERAS, FLIGHTS, WEATHER];
