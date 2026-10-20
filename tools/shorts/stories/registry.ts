import { borders } from './borders';
import { chronicle } from './chronicle';
import type { Maker } from './context';
import { deepTime } from './deep-time';
import { events } from './events';
import { feature } from './feature';
import { measure } from './measure';

/** Every story and tour `shorts make` knows. */
export const MAKERS: Maker[] = [deepTime, borders, chronicle, events, measure, feature];
