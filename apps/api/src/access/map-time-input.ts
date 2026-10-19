import { MAP_LAYER_SECTIONS } from '@takip/core/entitlements';
import { USAGE_ACTIONS, type UsageAction } from '@takip/core/usage';

const MAX_FEATURES = 64;
const MAX_ACTION_COUNT = 500;

// What the web app may report with a tick. Layer keys are many and change with the app, so only their shape is checked.
const FEATURES: Record<string, ReadonlySet<string> | RegExp> = {
  view: new Set(['map', 'space', 'history', 'replay']),
  panel: new Set(['none', 'layers', 'ai', 'draw', 'alerts', 'history', 'recon', 'directions', 'space', 'arcgis', 'markets', 'intel', 'search']),
  window: new Set(['camera', 'feed', 'dossier', 'search']),
  device: new Set(['desktop', 'mobile']),
  section: new Set(MAP_LAYER_SECTIONS),
  layer: /^[a-z][a-z0-9_]{0,39}$/,
};
const ACTIONS: ReadonlySet<string> = new Set(USAGE_ACTIONS);

/** A browser's own id and how it first arrived, from the tick body; the user agent comes from the request. */
export type VisitorTick = { id: string; userAgent: string | null; referrer: string | null; landing: string | null };

export type ActionCounts = [UsageAction, number][];

const VISITOR_ID = /^[A-Za-z0-9_-]{16,64}$/;
const HOST = /^[a-z0-9.-]{1,200}$/i;
// Landing pages can carry one-time tokens (password reset links), so only campaign and share parameters stay.
const KEPT_PARAM = /^(utm_[a-z]+|ref|source|w)$/;

/** The `visitor` part of a tick body, or null when it has no usable id. */
export function parseVisitor(input: unknown, userAgent: string | null | undefined): VisitorTick | null {
  const v = input as { id?: unknown; referrer?: unknown; landing?: unknown } | null;
  if (!v || typeof v.id !== 'string' || !VISITOR_ID.test(v.id)) return null;
  const referrer = typeof v.referrer === 'string' && HOST.test(v.referrer) ? v.referrer.toLowerCase() : null;
  let landing: string | null = null;
  if (typeof v.landing === 'string' && v.landing.startsWith('/') && v.landing.length <= 2000) {
    const url = new URL(v.landing, 'http://local');
    const kept = [...url.searchParams].filter(([name]) => KEPT_PARAM.test(name)).slice(0, 8);
    landing = (url.pathname + (kept.length ? `?${new URLSearchParams(kept)}` : '')).slice(0, 300);
  }
  return { id: v.id, userAgent: userAgent?.slice(0, 400) || null, referrer, landing };
}

/** The known `kind:name` features in a tick body, deduplicated; anything else is dropped. */
export function parseFeatures(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string' || out.size >= MAX_FEATURES) continue;
    const [kind, name, extra] = item.split(':');
    const allowed = FEATURES[kind];
    if (extra !== undefined || !name || !allowed) continue;
    if (allowed instanceof RegExp ? allowed.test(name) : allowed.has(name)) out.add(item);
  }
  return [...out];
}

/** `{ 'search.run': 2, … }` from a tick body: known actions with whole positive counts, each capped. */
export function parseActions(input: unknown): ActionCounts {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  return Object.entries(input as Record<string, unknown>)
    .filter((entry): entry is [UsageAction, number] => ACTIONS.has(entry[0]) && Number.isInteger(entry[1]) && (entry[1] as number) > 0)
    .map(([action, n]) => [action, Math.min(n, MAX_ACTION_COUNT)]);
}

/** Cloudflare's guess at the caller's country, when Cloudflare is the trusted edge; XX and T1 (unknown, Tor) say nothing. */
export function edgeCountry(header: string | undefined, cloudflare: boolean): string | null {
  return cloudflare && header && /^[A-Z]{2}$/.test(header) && header !== 'XX' && header !== 'T1' ? header : null;
}
