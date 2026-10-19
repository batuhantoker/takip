import { ALPR_VIEW } from './alpr-body';
import { AURORA_VIEW } from './aurora-body';
import { CAMERAS_VIEW } from './cameras-body';
import { FLIGHTS_VIEW } from './flights-body';
import { HAZARDS_VIEW } from './hazards-body';
import { HIKING_VIEW } from './hiking-body';
import { ISS_VIEW } from './iss-body';
import { PORTS_VIEW } from './ports-body';
import { TRANSIT_VIEW } from './transit-body';
import type { TopicView } from './view';
import { WEATHER_VIEW } from './weather-body';

/** Each place topic's view, by the id of its module in lib/platform/site/places/topics. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each topic has its own data and live types
export const TOPIC_VIEWS: Record<string, TopicView<any, any>> = {
  transit: TRANSIT_VIEW,
  cameras: CAMERAS_VIEW,
  alpr: ALPR_VIEW,
  flights: FLIGHTS_VIEW,
  weather: WEATHER_VIEW,
  ports: PORTS_VIEW,
  iss: ISS_VIEW,
  aurora: AURORA_VIEW,
  hazards: HAZARDS_VIEW,
  hiking: HIKING_VIEW,
};
