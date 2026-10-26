/** The package and bundle id of the phone apps (apps/mobile/capacitor.config.ts). */
export const APP_ID = 'dev.takip.app';

// Sign-in and the API must stay in the browser (handoff.ts), and the download files are for browsers.
const BROWSER_ONLY = ['/api/*', '/app/*', '/download/*', '/embed/*', '/admin/*'];

/** /.well-known/assetlinks.json: lets Android open takip.dev links in the app signed with these keys. */
export function assetLinks(fingerprints: string | undefined) {
  const keys = (fingerprints ?? '').split(',').map(k => k.trim().toUpperCase()).filter(k => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(k));
  if (!keys.length) return null;
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: APP_ID, sha256_cert_fingerprints: keys },
  }];
}

/** /.well-known/apple-app-site-association: the same for the iPhone app, once it has a team. */
export function appleAppSiteAssociation(teamId: string | undefined) {
  if (!teamId || !/^[A-Z0-9]{10}$/.test(teamId)) return null;
  return {
    applinks: {
      details: [{
        appIDs: [`${teamId}.${APP_ID}`],
        components: [...BROWSER_ONLY.map(path => ({ '/': path, exclude: true })), { '/': '/*' }],
      }],
    },
  };
}
