import type { PanelLink, ViewModeLink } from '@/lib/map/view-mode-link';
import type { SectionId, Spot } from '../catalog/types';
import type { MapView } from '../map-link';

/**
 * A guide at /guides/<slug>: an evergreen explainer that people search for ("how to track a flight", "what GPS
 * jamming looks like"). Every claim has to be true of TAKIP's data: its facts come from the layer pages it names
 * (`layers`) and the code behind them, and anything outside TAKIP is said as general knowledge, not as ours.
 */
export interface Guide {
  slug: string;
  /** Which part of the map it belongs to, for its icon. */
  section: SectionId;
  /** The <title>, up to 60 characters. */
  title: string;
  /** 110 to 160 characters. */
  description: string;
  heading: string;
  lede: string;
  /** The layer pages it explains, by slug: the source of its facts, linked at the end. */
  layers: string[];
  /** Where "Open the live map" lands. */
  open: { layers: string[]; view?: MapView; track?: string; mode?: ViewModeLink; panel?: PanelLink };
  sections: GuideSection[];
  /** The day it was written or last checked against the code, YYYY-MM-DD. */
  checked: string;
  /** The guide exists only when this server has the variable, like its layer (ships need AIS_API_KEY). */
  requiresEnv?: string;
}

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  /** Numbered steps on the map. */
  steps?: string[];
  /** Places to look, each opening the map there. */
  spots?: Spot[];
}
