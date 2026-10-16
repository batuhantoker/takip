import type * as maplibregl from 'maplibre-gl';

export const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

export type CirclePaint = NonNullable<Extract<Parameters<maplibregl.Map['addLayer']>[0], { type: 'circle' }>['paint']>;

/** A colour, or an expression for one, as addLayer takes it. */
export type LayerColor = NonNullable<Extract<Parameters<maplibregl.Map['addLayer']>[0], { type: 'circle' }>['paint']>['circle-color'];
