import { describe, expect, it } from 'vitest';
import { appleAppSiteAssociation, assetLinks } from './app-links';

const KEY = Array.from({ length: 32 }, () => 'ab').join(':');

describe('assetLinks', () => {
  it('names the app and every valid key', () => {
    const links = assetLinks(` ${KEY} , nonsense, ${KEY.replace(/ab/g, 'CD')}`);
    expect(links?.[0].target).toEqual({ namespace: 'android_app', package_name: 'dev.takip.app', sha256_cert_fingerprints: [KEY.toUpperCase(), KEY.replace(/ab/g, 'CD')] });
  });

  it('is null until a key is set', () => {
    expect(assetLinks(undefined)).toBeNull();
    expect(assetLinks('nonsense')).toBeNull();
  });
});

describe('appleAppSiteAssociation', () => {
  it('keeps sign-in and the API in the browser', () => {
    const aasa = appleAppSiteAssociation('ABCDE12345');
    const [details] = aasa!.applinks.details;
    expect(details.appIDs).toEqual(['ABCDE12345.dev.takip.app']);
    expect(details.components.at(-1)).toEqual({ '/': '/*' });
    expect(details.components).toContainEqual({ '/': '/app/*', exclude: true });
    expect(details.components).toContainEqual({ '/': '/api/*', exclude: true });
  });

  it('is null without a team id', () => {
    expect(appleAppSiteAssociation(undefined)).toBeNull();
    expect(appleAppSiteAssociation('team')).toBeNull();
  });
});
