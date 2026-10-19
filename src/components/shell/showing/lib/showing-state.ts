import { LAYER_GROUPS, primary, type LayerDef } from '@/components/panels/layers/layer-groups';
import { groupSections } from '@/components/panels/layers/lib/layer-sections';
import { sentenceCase } from '@/components/panels/layers/lib/sentence-case';
import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, type Translate } from '@/lib/core/i18n/translator';

/** Which map is on screen: today's, History's calendar, History's deep time, or Replay. */
export type ShowingMode = 'live' | 'history' | 'deep' | 'replay';

/** Everything the Showing chip reads, gathered from the page and the History session so rows and summary agree. */
export type ShowingState = {
  mode: ShowingMode;
  /** The calendar clock, epoch ms, in History and Replay. */
  time: number | null;
  /** History's country values past their last year are a projection. */
  projected: boolean;
  /** Deep time: millions of years ago, and the story chapter open, if any. */
  ma: number | null;
  chapter: string | null;
  /** The layers the map is given: the person's, with today's data off while History runs. */
  layers: Record<string, unknown>;
  /** Data layers the person has on that the past view hides until live. */
  paused: number;
  /** History's event families drawn. */
  families: string[];
  /** History's border layer, by code. */
  borders: string | null;
  /** The indicator colouring History's countries, and its ramp. */
  colouring: { code: string; name: string; ramp: string[] } | null;
  arcgis: { id: string; title: string; color: string }[];
  areas: { count: number; color: string | null };
};

/** Data layers in the Layers panel's order; display settings and sub-layer filters are not things drawn. */
export const DATA_LAYERS: LayerDef[] = groupSections(LAYER_GROUPS).flatMap(s => s.groups.flatMap(g => primary(g.layers)));

export const ENGLISH: Translate = createTranslator(DEFAULT_LOCALE, {});

export function layerLabel(l: LayerDef, t: Translate = ENGLISH) {
  const label = t(l.label);
  return label === l.label ? sentenceCase(label) : label;
}

/** Today's sky behind the globe: in the past views it is a backdrop, not part of the time shown. */
const BACKDROP = new Set(['sky_stars']);

export const partOfView = (key: string, mode: ShowingMode) => mode === 'live' || !BACKDROP.has(key);

/** The data layers the map draws for the mode, in the Layers panel's order. */
export const layersDrawn = (layers: Record<string, unknown>, mode: ShowingMode) => DATA_LAYERS.filter(l => layers[l.key] === true && partOfView(l.key, mode));
