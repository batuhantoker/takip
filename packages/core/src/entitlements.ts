/*
 * Every entitlement a plan can carry. Values live in bill_plan_entitlement as JSON scalars; a plan
 * without a valid row gets `fallback`: the most restrictive value for what plans sell, but open for
 * map access, so a key added later never hides the map. `hint` is shown in Admin → Plans.
 */
const bool = { type: 'bool', fallback: false } as const;
const int = { type: 'int', fallback: 0 } as const;
const licenceTiers = ['anon', 'free', 'paid'] as const;

/** The Layers panel's sections (src/components/panels/layers/lib/layer-sections.ts), each switchable per plan. */
export const MAP_LAYER_SECTIONS = ['air', 'sea', 'land', 'space', 'weather', 'conflict', 'cameras', 'reference'] as const;
export type MapLayerSection = (typeof MAP_LAYER_SECTIONS)[number];
export const layerEntitlement = <S extends MapLayerSection>(section: S) => `map.layers.${section}` as const;

const layerSection = { type: 'bool', fallback: true, hint: "Off: the section's layers can't be switched on" } as const;
const layerSections = Object.fromEntries(MAP_LAYER_SECTIONS.map(section => [layerEntitlement(section), layerSection])) as {
  [S in MapLayerSection as `map.layers.${S}`]: typeof layerSection;
};

export const CATALOGUE = {
  'map.live': bool,
  'map.minutes_per_day': { ...int, hint: 'Minutes of map a day, counted while a tab is open; 0 = no limit' },
  ...layerSections,
  'api.enabled': bool,
  'api.keys.max': int,
  'api.requests_per_day': int,
  'api.rps': int,
  'web.rps': int,
  'replay.lookback_days': int,
  'replay.window_hours': int,
  'workspaces.max': int,
  'workspaces.share': bool,
  'export.enabled': bool,
  'ai.hosted': bool,
  'ai.assistant': { ...bool, hint: 'The TI assistant tab' },
  'ads.off': bool,
  'data.licence_tier': { type: 'enum', values: licenceTiers, fallback: 'anon' },
} as const;

type Catalogue = typeof CATALOGUE;
export type EntitlementKey = keyof Catalogue;

type ValueOf<S> = S extends { type: 'bool' } ? boolean
  : S extends { type: 'int' } ? number
  : S extends { type: 'enum'; values: readonly (infer V)[] } ? V
  : never;

export type Entitlements = { [K in EntitlementKey]: ValueOf<Catalogue[K]> };
export type BoolEntitlement = { [K in EntitlementKey]: Catalogue[K]['type'] extends 'bool' ? K : never }[EntitlementKey];

export const isEntitlementKey = (key: string): key is EntitlementKey => key in CATALOGUE;

/** The stored JSON value, or undefined when it doesn't fit the key's type. */
export function parseValue<K extends EntitlementKey>(key: K, raw: string): Entitlements[K] | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const spec = CATALOGUE[key] as { type: string; values?: readonly string[] };
  const fits =
    spec.type === 'bool' ? typeof value === 'boolean'
    : spec.type === 'int' ? Number.isInteger(value) && (value as number) >= 0
    : spec.values!.includes(value as string);
  return fits ? (value as Entitlements[K]) : undefined;
}

export function fallbacks(): Entitlements {
  return Object.fromEntries(Object.entries(CATALOGUE).map(([key, spec]) => [key, spec.fallback])) as Entitlements;
}

/** What a caller may do: their plan's entitlements plus any per-user overrides. */
export type Access = {
  plan: { id: string; name: string };
  entitlements: Entitlements;
  /** Null when the plan is the default one: anon for visitors, free for signed-in users. */
  subscription: { provider: string; status: string; until: number | null } | null;
};

export type PlanAccess = { id: string; name: string; entitlements: Entitlements };
