/**
 * Static reference datasets served from data/reference/ (see its README):
 * US transport and infrastructure from NTAD, airports worldwide from OurAirports.
 * Shared by the API and the map, so it must stay free of server-only imports.
 */

import { msg } from '@/lib/core/i18n/translator';

export type ReferenceGeometry = 'point' | 'line' | 'polygon';

export const REFERENCE_GROUPS = [
  { id: 'airfields', label: msg('AIRFIELDS'), fullLabel: msg('AIRFIELDS & SPACEPORTS') },
  { id: 'rail_road', label: msg('RAIL/ROAD'), fullLabel: msg('RAIL, ROAD & BUS') },
  { id: 'waterways', label: msg('WATERWAYS'), fullLabel: msg('FERRIES, WATERWAYS & PORTS') },
  { id: 'sites', label: msg('SITES'), fullLabel: msg('BASES, DAMS & PARKS') },
] as const;

export type ReferenceGroupId = (typeof REFERENCE_GROUPS)[number]['id'];

/** Below `belowZoom`, only features whose `property` is one of `values` are served. */
export interface ReferenceTier {
  belowZoom: number;
  property: string;
  values: readonly (string | number)[];
}

export interface ReferenceDataset {
  /** File stem under data/reference/ and the API path segment. */
  id: string;
  /** Key in the page's activeLayers. */
  key: string;
  label: string;
  description: string;
  group: ReferenceGroupId;
  geometry: ReferenceGeometry;
  color: string;
  /** Nothing is served or drawn below this zoom; it is what keeps responses small. */
  minZoom: number;
  /** Ordered by `belowZoom`, lowest first. */
  tiers?: readonly ReferenceTier[];
  /** Cut lines to the requested box: long routes cross every view, so a box alone cannot thin them. */
  clip?: boolean;
  /** Property used as the feature's title in its popup and label. */
  titleProp: string;
  attribution: string;
}

const NTAD = 'US DOT / BTS National Transportation Atlas Database';

export const REFERENCE_DATASETS = [
  {
    id: 'airports', key: 'ref_airports', label: msg('Airports'), group: 'airfields', geometry: 'point',
    description: msg('OurAirports · worldwide · small fields zoom 6+, heliports 8+'),
    color: '#90CAF9', minZoom: 2, titleProp: 'name', attribution: 'OurAirports (public domain)',
    tiers: [
      { belowZoom: 6, property: 'type', values: ['large_airport', 'medium_airport'] },
      { belowZoom: 8, property: 'type', values: ['large_airport', 'medium_airport', 'small_airport', 'seaplane_base'] },
    ],
  },
  {
    id: 'runways', key: 'ref_runways', label: msg('Runways'), group: 'airfields', geometry: 'line',
    description: msg('OurAirports · zoom 9+'), color: '#B0BEC5', minZoom: 9, titleProp: 'name',
    attribution: 'OurAirports (public domain)',
  },
  {
    id: 'spaceports', key: 'ref_spaceports', label: msg('Spaceports'), group: 'airfields', geometry: 'point',
    description: msg('NTAD · US'), color: '#E040FB', minZoom: 2, titleProp: 'Name', attribution: NTAD,
  },
  {
    id: 'rail-class-i', key: 'ref_rail_class_i', label: msg('Freight Rail (Class I)'), group: 'rail_road', geometry: 'line',
    description: msg('NTAD · US, CA, MX · zoom 7+'), color: '#FF8A65', minZoom: 7, titleProp: 'SUBDIV', attribution: NTAD,
  },
  {
    id: 'rail-passenger', key: 'ref_rail_passenger', label: msg('Passenger Rail'), group: 'rail_road', geometry: 'line',
    description: msg('NTAD · US · zoom 5+'), color: '#FFD54F', minZoom: 5, titleProp: 'SUBDIV', attribution: NTAD,
  },
  {
    id: 'amtrak-routes', key: 'ref_amtrak_routes', label: msg('Amtrak Routes'), group: 'rail_road', geometry: 'line',
    description: msg('NTAD · 49 services'), color: '#EF5350', minZoom: 3, titleProp: 'name', attribution: NTAD,
  },
  {
    id: 'highway-freight-network', key: 'ref_highway_freight', label: msg('Freight Highways'), group: 'rail_road', geometry: 'line',
    description: msg('NTAD · 2023 · zoom 4+'), color: '#A1887F', minZoom: 4, titleProp: 'SIGN1', attribution: NTAD,
  },
  {
    id: 'highway-planning-network', key: 'ref_highway_network', label: msg('Highway Network'), group: 'rail_road', geometry: 'line',
    description: msg('NTAD · 2014 · zoom 8+, all roads 11+'), color: '#90A4AE', minZoom: 8, titleProp: 'SIGN1', attribution: NTAD,
    tiers: [
      { belowZoom: 9, property: 'F_SYSTEM', values: [1, 2] },
      { belowZoom: 11, property: 'F_SYSTEM', values: [1, 2, 3] },
    ],
  },
  {
    id: 'tunnels', key: 'ref_tunnels', label: msg('Road Tunnels'), group: 'rail_road', geometry: 'point',
    description: msg('NTAD · US · zoom 4+'), color: '#FFB74D', minZoom: 4, titleProp: 'tunnel_name_i2', attribution: NTAD,
  },
  {
    id: 'intercity-bus-routes', key: 'ref_bus_routes', label: msg('Intercity Bus Routes'), group: 'rail_road', geometry: 'line',
    description: msg('NTAD · US · zoom 8+'), color: '#81C784', minZoom: 8, titleProp: 'route_long_name', attribution: NTAD,
    clip: true,
  },
  {
    id: 'intercity-bus-stops', key: 'ref_bus_stops', label: msg('Intercity Bus Stops'), group: 'rail_road', geometry: 'point',
    description: msg('NTAD · US · zoom 4+'), color: '#66BB6A', minZoom: 4, titleProp: 'stop_name', attribution: NTAD,
  },
  {
    id: 'ferry-routes', key: 'ref_ferry_routes', label: msg('Ferry Routes'), group: 'waterways', geometry: 'line',
    description: msg('NTAD · US · zoom 4+'), color: '#4DD0E1', minZoom: 4, titleProp: 'segment_name', attribution: NTAD,
  },
  {
    id: 'ferry-terminals', key: 'ref_ferry_terminals', label: msg('Ferry Terminals'), group: 'waterways', geometry: 'point',
    description: msg('NTAD · US · zoom 4+'), color: '#26C6DA', minZoom: 4, titleProp: 'TERMINAL_NAME', attribution: NTAD,
  },
  {
    id: 'waterway-links', key: 'ref_waterways', label: msg('Navigable Waterways'), group: 'waterways', geometry: 'line',
    description: msg('USACE via NTAD · zoom 4+'), color: '#29B6F6', minZoom: 4, titleProp: 'LINKNAME', attribution: NTAD,
  },
  {
    id: 'waterway-nodes', key: 'ref_waterway_nodes', label: msg('Waterway Nodes & Ports'), group: 'waterways', geometry: 'point',
    description: msg('USACE via NTAD · zoom 6+'), color: '#5C6BC0', minZoom: 6, titleProp: 'PORT_NAME', attribution: NTAD,
  },
  {
    id: 'port-statistical-areas', key: 'ref_port_areas', label: msg('Port Areas'), group: 'waterways', geometry: 'polygon',
    description: msg('USACE via NTAD · zoom 4+'), color: '#7986CB', minZoom: 4, titleProp: 'FEATURENAME', attribution: NTAD,
  },
  {
    id: 'military-bases', key: 'ref_military_bases', label: msg('US Military Bases'), group: 'sites', geometry: 'polygon',
    description: msg('DoD MIRTA via NTAD'), color: '#E57373', minZoom: 3, titleProp: 'siteName', attribution: NTAD,
  },
  {
    id: 'dams', key: 'ref_dams', label: msg('Dams'), group: 'sites', geometry: 'point',
    description: msg('National Inventory of Dams · zoom 7+'), color: '#4DB6AC', minZoom: 7, titleProp: 'name', attribution: NTAD,
  },
  {
    id: 'nps-boundaries', key: 'ref_national_parks', label: msg('National Park Units'), group: 'sites', geometry: 'polygon',
    description: msg('NPS · zoom 5+'), color: '#9CCC65', minZoom: 5, titleProp: 'UNIT_NAME', attribution: 'US National Park Service',
  },
] as const satisfies readonly ReferenceDataset[];

export type ReferenceDatasetId = (typeof REFERENCE_DATASETS)[number]['id'];
export type ReferenceLayerKey = (typeof REFERENCE_DATASETS)[number]['key'];

/** All off: these are big, US-centric layers a reader opts into. */
export const REFERENCE_LAYER_DEFAULTS = Object.fromEntries(
  REFERENCE_DATASETS.map(d => [d.key, false]),
) as Record<ReferenceLayerKey, boolean>;

export function referenceDataset(id: string): ReferenceDataset | undefined {
  return (REFERENCE_DATASETS as readonly ReferenceDataset[]).find(d => d.id === id);
}

/** The filter that applies at `zoom`, or undefined when every feature is served. */
export function tierAt(dataset: ReferenceDataset, zoom: number): ReferenceTier | undefined {
  return dataset.tiers?.find(t => zoom < t.belowZoom);
}
