import type { PlaceTopic } from '../topic';
import { ALPR } from './alpr';
import { ATTRACTIONS } from './attractions';
import { AURORA } from './aurora';
import { CAMERAS } from './cameras';
import { FLIGHTS } from './flights';
import { HAZARDS } from './hazards';
import { HIKING } from './hiking';
import { HOLIDAYS } from './holidays';
import { INDICATOR_TOPIC } from './indicators';
import { NOW } from './now';
import { ISS } from './iss';
import { PORTS } from './ports';
import { PRAYER } from './prayer';
import { PRAYERS } from './prayers';
import { RAMADAN_TOPIC } from './ramadan';
import { SHABBAT } from './shabbat';
import { SUN } from './sun';
import { TRANSIT } from './transit';
import { WEATHER } from './weather';

/** Every place topic, in the order a place's overview lists them. Each one's body is in components/site/places/topics. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each topic has its own data and live types
export const TOPICS: readonly PlaceTopic<any, any>[] = [NOW, ATTRACTIONS, TRANSIT, CAMERAS, ALPR, FLIGHTS, WEATHER, PORTS, ISS, SUN, PRAYERS, PRAYER, RAMADAN_TOPIC, SHABBAT, AURORA, HAZARDS, HIKING, INDICATOR_TOPIC, HOLIDAYS];
