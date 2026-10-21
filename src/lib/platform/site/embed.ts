import type { EmbedSpec } from '@/lib/map/embed/spec';
import type { LayerPage } from './catalog/types';

/** A page gets a live embed when it shows layers on today's map at a view: not History, deep time, Space, Replay or a tool. */
export const hasEmbed = (page: LayerPage) => !page.mode && !page.panel && !!page.view;

/** A layer page's embed. Any other spec goes through embedHref (lib/map/embed/spec.ts). */
export const embedPath = (slug: string) => `/embed/${slug}`;

export const pageEmbed = (page: LayerPage): EmbedSpec => ({ layers: page.layers, view: page.view, track: page.track, ...(page.near ? { near: page.near } : {}) });
