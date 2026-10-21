import type { PanelLink, ViewModeLink } from '@/lib/map/view-mode-link';
import type { LiveImageId } from '../live-images';
import type { MapView } from '../map-link';

export type SectionId = 'air' | 'sea' | 'space' | 'weather' | 'hazards' | 'cameras' | 'ground' | 'world' | 'network' | 'past' | 'tools';

/** A place worth opening the layer at. */
export interface Spot { label: string; view: MapView; note?: string }

/** A live line the page fetches when it renders; see ../live. */
export type LiveId = 'earthquakes' | 'launches' | 'aurora' | 'iss' | 'outages';

/**
 * One public page about a layer (or a few layers people look for together), at /map/<slug>.
 * Everything here is shown as written, so it has to be true of the code: name real sources,
 * real refresh rates and real limits, and call estimates and timetables what they are.
 */
export interface LayerPage {
  slug: string;
  section: SectionId;
  /** Layer keys switched on by "Open on the map" (the base display layers are added). */
  layers: string[];
  /**
   * The zoom to open at around the visitor (IP location, never a prompt), with `view` as the fallback and what
   * the page's picture shows. Unset where the view is the subject: a hurricane basin, a war, an era.
   */
  near?: number;
  /** What the map follows on opening, as `satellite:25544`. */
  track?: string;
  /** The place topic that is this layer close up (`weather`): the page links the biggest places' pages of it. */
  places?: string;
  /** A box under the heading that finds an aircraft in the air and opens the map following it. */
  findFlights?: boolean;
  /** A box under the heading that answers whether there is lightning, or rain, near the visitor right now, or (weather) what it is like there, with the forecast below. */
  nearNow?: 'lightning' | 'rain' | 'weather';
  /** Another view to open: History at a year, deep time, Space or Replay. */
  mode?: ViewModeLink;
  /** A sidebar panel to open. */
  panel?: PanelLink;
  /** The <title>, without the site name. Up to 60 characters. */
  title: string;
  /** The meta description and share text. 110 to 160 characters. */
  description: string;
  heading: string;
  /** One or two sentences under the heading. */
  lede: string;
  /** What you see on the map, and what a click shows. */
  shows: string[];
  sources: { name: string; detail: string }[];
  /** How fresh the data is, in a sentence. */
  freshness: string;
  /** Coverage gaps and caveats, said plainly. */
  limits: string[];
  /** Where "Open on the map" lands; without it, the visitor's own city (or, for another view, that view's own start). */
  view?: MapView;
  spots?: Spot[];
  related: string[];
  live?: LiveId;
  /** The latest picture of the Sun or the Earth, shown on the page (../live-images.ts). */
  liveImage?: LiveImageId;
  /** The page exists only when this server has this environment variable (the layer is hidden without it). */
  requiresEnv?: string;
  /** History event kinds the page is about: their event pages link back to it, and it lists some of them. */
  eventKinds?: string[];
}
