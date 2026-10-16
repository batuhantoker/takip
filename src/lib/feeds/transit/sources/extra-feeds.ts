import { CTA_URL } from './cta';
import { FGC_URL } from './fgc';
import { HAFAS_RADARS } from './hafas';
import { IETT_URL } from './iett';
import { LAMETRO_RAIL_URL } from './lametro';
import { TFL_TUBE_GRAPH, TFL_TUBE_URL } from './tfl';
import type { TransitMode } from '../modes';
import type { TransitFeed } from '../select';

/** Sources neither catalogue lists, with what they run (they have no routes.txt to read it from). */
export const EXTRA_FEEDS: (TransitFeed & { modes: TransitMode[] })[] = [
  { id: 'iett', name: 'İETT · Istanbul buses', kind: 'iett', url: IETT_URL, bbox: [27.95, 40.75, 29.95, 41.6], size: 6000, license: 'https://data.ibb.gov.tr/en/', modes: ['bus'] },
  { id: 'lametro-rail', name: 'LA Metro Rail', kind: 'lametro', url: LAMETRO_RAIL_URL, bbox: [-118.55, 33.74, -117.68, 34.2], size: 80, license: 'https://developer.metro.net/terms-conditions/', modes: ['metro', 'tram'] },
  { id: 'cta-l', name: "CTA 'L'", kind: 'cta', url: CTA_URL, bbox: [-87.95, 41.68, -87.58, 42.1], size: 115, license: 'https://www.transitchicago.com/developers/terms/', modes: ['metro'] },
  {
    id: 'tfl-tube', name: 'London Underground', kind: 'tfl', url: TFL_TUBE_URL, bbox: [-0.63, 51.39, 0.27, 51.71], size: 300,
    license: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service', graph: TFL_TUBE_GRAPH, modes: ['metro'],
  },
  ...([
    ['hafas-copenhagen', 'Copenhagen Metro', 40],
    ['hafas-vienna', 'Wiener Linien U-Bahn', 60],
    ['hafas-munich', 'MVG U-Bahn · Munich', 60],
    ['hafas-hamburg', 'Hochbahn U-Bahn · Hamburg', 50],
    ['hafas-frankfurt', 'VGF U-Bahn · Frankfurt', 40],
  ] as const).map(([id, name, size]) => ({ id, name, kind: 'hafas' as const, url: HAFAS_RADARS[id].endpoint, bbox: HAFAS_RADARS[id].bbox, size, modes: ['metro' as const] })),
  { id: 'fgc', name: 'FGC · Barcelona', kind: 'fgc', url: FGC_URL, bbox: [1.75, 41.35, 2.25, 41.75], size: 40, license: 'https://dadesobertes.fgc.cat/', modes: ['metro', 'rail'] },
  // ODPT's public, keyless endpoint; trains sit at their station, their status saying whether stopped or between.
  {
    id: 'toei-train', name: 'Toei Subway', kind: 'gtfs-rt', url: 'https://api-public.odpt.org/api/v4/gtfs/realtime/toei_odpt_train_vehicle',
    bbox: [139.6, 35.55, 139.95, 35.82], size: 110, license: 'https://creativecommons.org/licenses/by/4.0/',
    static: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip', modes: ['metro'],
  },
];
