/**
 * Actions the web app counts for the admin's analytics: names only, never what was typed, searched or looked up.
 * The api accepts exactly these (apps/api/src/access/map-time.ts); add a name here before counting it.
 */
export const USAGE_ACTIONS = [
  'search.run', 'search.pick',
  'alert.open',
  'route.plan', 'route.navigate',
  'area.draw',
  'recon.email', 'recon.domain', 'recon.ip', 'recon.username', 'recon.phone', 'recon.wallet', 'recon.cve', 'recon.sanctions', 'recon.other',
  'ti.ask',
  'camera.open', 'feed.open', 'dossier.open',
  'history.open', 'history.jump',
  'replay.start',
  'space.enter', 'space.focus',
  'arcgis.add',
  'workspace.save', 'workspace.share',
  'link.share', 'report.send',
  'layer.on', 'layer.off', 'basemap.change',
  'account.sign_up_open', 'account.sign_in_open',
  'tour.offer', 'tour.decline', 'tour.start', 'tour.inside', 'tour.skip', 'tour.finish',
] as const;

export type UsageAction = (typeof USAGE_ACTIONS)[number];
