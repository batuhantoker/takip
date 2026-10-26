import type { Access } from '@takip/core/entitlements';

/** `ca-pub-…` from a publisher ID written with or without the `ca-` prefix; null when it isn't one. */
export function parseAdClient(raw: string | undefined): string | null {
  const id = raw?.trim().match(/^(?:ca-)?pub-(\d{10,20})$/)?.[1];
  return id ? `ca-pub-${id}` : null;
}

/** Unset turns off the ads, Google's script and the ad-blocker check: self-hosted copies and dev see none. */
export const AD_CLIENT = parseAdClient(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

/** AdSense display units by placement; a placement without one stays empty. */
export const AD_SLOTS = {
  panel: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PANEL || null,
  page: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PAGE || null,
};

// /app: the apps' sign-in steps, passed through in the system browser.
const AD_FREE_PATHS = ['/admin', '/privacy', '/terms', '/app'];

/** Ads only once the plan is known, so a paying user never sees one flash by. */
export function showAds(client: string | null, access: Access | null, pathname: string): boolean {
  if (!client || !access || access.entitlements['ads.off']) return false;
  return !AD_FREE_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/** The /ads.txt line that authorises Google to sell this site's inventory. */
export function adsTxt(client: string): string {
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

export const ADBLOCK_SNOOZE_KEY = 'takip.adblock.snoozedUntil';
export const ADBLOCK_SNOOZE_MS = 24 * 60 * 60 * 1000;

export function adblockSnoozed(stored: string | null, now: number): boolean {
  const until = Number(stored);
  return Number.isFinite(until) && until > now;
}
