import { describe, expect, it } from 'vitest';
import { fallbacks, type Access } from '@takip/core/entitlements';
import { adblockSnoozed, adsTxt, parseAdClient, showAds } from './ads';

const access = (adsOff: boolean): Access => ({
  plan: { id: adsOff ? 'pro' : 'free', name: '' },
  entitlements: { ...fallbacks(), 'ads.off': adsOff },
  subscription: null,
});
const CLIENT = 'ca-pub-1234567890123456';

describe('parseAdClient', () => {
  it('takes the publisher ID with or without the ca- prefix', () => {
    expect(parseAdClient('ca-pub-1234567890123456')).toBe(CLIENT);
    expect(parseAdClient(' pub-1234567890123456 ')).toBe(CLIENT);
  });

  it('refuses anything else', () => {
    for (const raw of [undefined, '', 'pub-', 'ca-pub-12ab', 'ca-pub-1234567890123456"><script>']) {
      expect(parseAdClient(raw)).toBeNull();
    }
  });
});

describe('showAds', () => {
  it('shows ads to plans without ads.off', () => {
    expect(showAds(CLIENT, access(false), '/')).toBe(true);
    expect(showAds(CLIENT, access(false), '/docs')).toBe(true);
  });

  it('never shows them to a plan with ads.off, or before the plan is known', () => {
    expect(showAds(CLIENT, access(true), '/')).toBe(false);
    expect(showAds(CLIENT, null, '/')).toBe(false);
  });

  it('stays off without a publisher ID', () => {
    expect(showAds(null, access(false), '/')).toBe(false);
  });

  it('keeps the admin console and the privacy page clear', () => {
    expect(showAds(CLIENT, access(false), '/privacy')).toBe(false);
    expect(showAds(CLIENT, access(false), '/admin/users')).toBe(false);
    expect(showAds(CLIENT, access(false), '/administrator')).toBe(true);
    expect(showAds(CLIENT, access(false), '/app/handoff')).toBe(false);
    expect(showAds(CLIENT, access(false), '/apps')).toBe(true);
  });
});

describe('adsTxt', () => {
  it('names the publisher without the ca- prefix', () => {
    expect(adsTxt(CLIENT)).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  });
});

describe('adblockSnoozed', () => {
  it('holds until the stored time', () => {
    expect(adblockSnoozed('2000', 1000)).toBe(true);
    expect(adblockSnoozed('2000', 3000)).toBe(false);
  });

  it('treats a missing or garbled value as not snoozed', () => {
    expect(adblockSnoozed(null, 1000)).toBe(false);
    expect(adblockSnoozed('soon', 1000)).toBe(false);
  });
});
