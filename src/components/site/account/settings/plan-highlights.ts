import { layerEntitlement, MAP_LAYER_SECTIONS, type Entitlements } from '@takip/core/entitlements';
import { AD_CLIENT } from '@/lib/platform/ads';
import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, type Translate } from '@/lib/core/i18n/translator';

const ENGLISH = createTranslator(DEFAULT_LOCALE, {});
const whole = (days: number) => days >= 365 && days % 365 === 0;

const lookback = (days: number, t: Translate) => (whole(days)
  ? t('Replay up to {n, plural, one {# year} other {# years}} back', { n: days / 365 })
  : t('Replay up to {n, plural, one {# day} other {# days}} back', { n: days }));

function replayWindow(h: number, t: Translate) {
  if (h % 24 !== 0) return t('Replay up to {n, plural, one {# hour} other {# hours}} at a time', { n: h });
  const days = h / 24;
  return whole(days)
    ? t('Replay up to {n, plural, one {# year} other {# years}} at a time', { n: days / 365 })
    : t('Replay up to {n, plural, one {# day} other {# days}} at a time', { n: days });
}

/** Only features that exist today are offered; a feature's entitlements join this list when it ships. */
const BUILT: (keyof Entitlements)[] = [
  'map.minutes_per_day', 'ai.assistant', ...MAP_LAYER_SECTIONS.map(layerEntitlement),
  'api.enabled', 'api.requests_per_day', 'api.rps', 'api.keys.max',
  'replay.lookback_days', 'replay.window_hours',
  'web.rps',
  'ai.hosted',
  'recon.scan',
  'ads.off',
];

/** The entitlements worth naming to a person, in words; null when the plan lacks it. */
const HIGHLIGHTS: ((e: Entitlements, t: Translate) => string | null)[] = [
  (e, t) => (e['map.minutes_per_day']
    ? t('{n, plural, one {# minute of map a day} other {# minutes of map a day}}', { n: e['map.minutes_per_day'] })
    : t('No time limit on the map')),
  (e, t) => (MAP_LAYER_SECTIONS.every(s => e[layerEntitlement(s)]) ? t('Every map layer') : null),
  (e, t) => (e['ai.assistant'] ? t('The TI assistant') : null),
  (e, t) => (e['api.enabled']
    ? t('API access: {requests} requests a day, {rps} a second per key, {keys, plural, one {# key} other {# keys}}', {
      requests: e['api.requests_per_day'], rps: e['api.rps'], keys: e['api.keys.max'],
    })
    : null),
  (e, t) => lookback(e['replay.lookback_days'], t),
  (e, t) => replayWindow(e['replay.window_hours'], t),
  (e, t) => t('Up to {n} requests a second in the app', { n: e['web.rps'] }),
  (e, t) => (e['workspaces.max'] ? t('{n, plural, one {# saved workspace} other {# saved workspaces}}', { n: e['workspaces.max'] }) : null),
  (e, t) => (e['workspaces.share'] ? t('Share workspaces by link') : null),
  (e, t) => (e['export.enabled'] ? t('Data export') : null),
  (e, t) => (e['ai.hosted'] ? t('Hosted AI, no key of your own needed') : null),
  (e, t) => (e['recon.scan'] ? t('Port scans, TLS checks and sweeps in Recon') : null),
  (e, t) => (AD_CLIENT && e['ads.off'] ? t('No ads') : null),
];

/** What moving from one plan to another adds, as short lines. */
export function planGains(current: Entitlements, next: Entitlements, t: Translate = ENGLISH): string[] {
  // Entitlements of unbuilt features keep the current plan's values, so they never read as gains.
  const offered: Entitlements = { ...current, ...Object.fromEntries(BUILT.map(key => [key, next[key]])) };
  return HIGHLIGHTS.map(line => [line(current, t), line(offered, t)] as const)
    .filter(([now, then]) => then !== null && then !== now)
    .map(([, then]) => then!);
}
