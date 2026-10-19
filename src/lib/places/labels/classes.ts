import { msg } from '@/lib/core/i18n/translator';

/**
 * The OpenMapTiles label classes a place popup names beside its kind ("Region · state"), by source
 * layer. Others are OpenStreetMap's own English words, which only English shows.
 */
export const CLASS_LABEL: Record<string, Record<string, string>> = {
  place: {
    continent: msg('place|continent'), country: msg('place|country'), state: msg('place|state'), province: msg('place|province'),
    city: msg('place|city'), town: msg('place|town'), village: msg('place|village'), hamlet: msg('place|hamlet'),
    suburb: msg('place|suburb'), quarter: msg('place|quarter'), neighbourhood: msg('place|neighbourhood'),
    isolated_dwelling: msg('place|isolated dwelling'), island: msg('place|island'),
  },
  water_name: {
    ocean: msg('place|ocean'), sea: msg('place|sea'), lake: msg('place|lake'), bay: msg('place|bay'),
    strait: msg('place|strait'), lagoon: msg('place|lagoon'), reservoir: msg('place|reservoir'),
  },
  waterway: { river: msg('place|river'), canal: msg('place|canal'), stream: msg('place|stream') },
  park: { national_park: msg('place|national park'), nature_reserve: msg('place|nature reserve'), protected_area: msg('place|protected area') },
  aerodrome_label: {
    international: msg('place|international'), public: msg('place|public'), regional: msg('place|regional'),
    military: msg('place|military'), private: msg('place|private'),
  },
};
