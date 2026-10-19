/*
 * Response shapes of GET /api/admin/analytics/* (apps/api/src/analytics/routes.ts).
 * Days are UTC 'YYYY-MM-DD', oldest first, every day in the range present; times are epoch ms.
 * Range endpoints take ?days=7|30|90 (default 30) and ?admins=exclude to leave admin accounts out.
 */

/** `since`: the first day the section has data for (map minutes, API counters or ingest runs); minutes start the day the tick shipped. */
export type AnalyticsRange = { today: string; since: string | null };

/** An address an account or visitor used the map from, placed with the DB-IP Lite city database (null where it has no answer). */
export type Place = {
  ip: string;
  /** ISO 3166-1 alpha-2. */
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Map minutes booked from this address. */
  minutes: number;
};

/** The latest place, as table rows show it. */
export type PlaceBrief = { ip: string; country: string | null; region: string | null; city: string | null };

/**
 * Where the browser itself said it was, when the person used their location on the map (Your location, Use my
 * location, navigation): rounded by the api, named by Nominatim (© OpenStreetMap contributors; label null until named).
 * Show it before the IP place, marked "shared"; the IP place, marked "from IP", can be hundreds of km off.
 */
export type DevicePlace = {
  latitude: number;
  longitude: number;
  /** The browser's own accuracy for the fix, in metres. */
  accuracyM: number | null;
  label: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  fixes: number;
};

/** The latest shared location, as table rows show it. */
export type DeviceBrief = { latitude: number; longitude: number; accuracyM: number | null; label: string | null; at: number };

/** Counts of named actions (packages/core/src/usage.ts USAGE_ACTIONS), e.g. 'search.run', 'route.plan', 'recon.email'. */
export type ActionUse = { action: string; count: number; users: number; visitors: number };

export type AudienceDay = {
  day: string;
  signups: number;
  /** Signed-in accounts with at least one map minute that day. */
  activeUsers: number;
  /** Anonymous visitors (a daily salted hash of their address block) with at least one map minute. */
  activeVisitors: number;
  userMinutes: number;
  visitorMinutes: number;
  /** Sign-ins: auth_session rows created that day. */
  sessions: number;
};

export type AnalyticsAudience = AnalyticsRange & {
  days: AudienceDay[];
  totals: {
    users: number;
    verified: number;
    twoFactor: number;
    banned: number;
    /** Active today, over the last 7 days and over the last 30 days (signed-in accounts). */
    dau: number;
    wau: number;
    mau: number;
    visitorsToday: number;
    /** Over the range: map minutes per active account-day and per visitor-day. */
    avgUserMinutes: number;
    avgVisitorMinutes: number;
  };
  /** Sign-in methods linked to accounts ('credential', 'google', …). */
  providers: { provider: string; users: number }[];
  plans: { plan: string; users: number }[];
  /** From the user agents of sessions created in the range. */
  devices: { kind: 'browser' | 'os' | 'device'; name: string; sessions: number }[];
  /** Weekly sign-up cohorts (week starts Monday, UTC): share of the cohort active in week +0…+7; null where that week hasn't happened. */
  cohorts: { week: string; size: number; retained: (number | null)[] }[];
  /** Accounts by the countries they used the map from in the range (place_seen); one account can be in several. */
  countries: { country: string; users: number }[];
};

export type FeatureUse = {
  /**
   * 'view:map|space|history|replay|wall', 'panel:<tool>|none', 'layer:<key>', 'section:air|sea|land|space|weather|conflict|cameras|reference'
   * (the Layers sections with a layer on), 'window:camera|feed|dossier|search', 'device:desktop|mobile'.
   */
  feature: string;
  minutes: number;
  /** Distinct accounts and visitor-days that spent time there. */
  users: number;
  visitors: number;
};

export type AnalyticsEngagement = AnalyticsRange & {
  /** The range asked for. */
  days: number;
  features: FeatureUse[];
  /** Minutes per day for the busiest `view:` and `panel:` features (top 8 of each), keyed by feature. */
  featureDays: { day: string; minutes: Record<string, number> }[];
  /** Minutes by UTC weekday (0 = Sunday) and hour, everyone together; only cells with minutes. */
  hours: { dow: number; hour: number; minutes: number }[];
  /** Map minutes per subject-day, bucketed: '1', '2–5', '6–15', '16–30', '31–60', '61–120', '120+'. */
  sessionLength: { bucket: string; users: number; visitors: number }[];
  topUsers: { userId: string; email: string; name: string; minutes: number; activeDays: number; lastDay: string; topFeature: string | null }[];
  /** Subjects that reached their plan's daily map limit (spent a minute on 'view:wall'). */
  wall: { day: string; users: number; visitors: number }[];
  /** Actions in the range, busiest first; `visitors` counts visitor ids and daily visitor hashes. */
  actions: ActionUse[];
  /** Actions per day for the 8 busiest. */
  actionDays: { day: string; counts: Record<string, number> }[];
};

export type AnalyticsApi = AnalyticsRange & {
  days: { day: string; requests: number; denied: number; bytes: number; callers: number; keys: number }[];
  groups: { group: string; requests: number; denied: number; bytes: number }[];
  keys: { total: number; active: number; revoked: number; usedInRange: number; createdInRange: number };
  topKeys: { keyId: string; prefix: string | null; name: string | null; email: string | null; requests: number; denied: number }[];
};

export type StorageItem = { name: string; bytes: number; files: number };

export type StorageGroup = {
  /** 'app-db', 'catalog', 'history', 'geo', 'tracks', 'stream', 'cache-db', 'archive', 'cold', 'backups', 'camera-cache'. */
  id: string;
  label: string;
  /** Relative to the repository root when inside it. */
  path: string;
  bytes: number;
  files: number;
  /** Biggest children first (databases with their -wal/-shm summed, archive sources, track LODs …). */
  items: StorageItem[];
};

export type AnalyticsStorage = {
  scannedAt: number;
  tookMs: number;
  /** The filesystem holding the data directory. */
  disk: { total: number; free: number; used: number } | null;
  total: number;
  groups: StorageGroup[];
  archive: {
    sources: { source: string; bytes: number; files: number; firstHour: string | null; lastHour: string | null }[];
    /** Bytes written per UTC day and source over the last 30 days (from the raw/<src>/YYYY/MM/DD/HH paths). */
    days: { day: string; bytes: Record<string, number> }[];
  };
  appTables: { table: string; rows: number }[];
};

export type AnalyticsData = AnalyticsRange & {
  /** False when catalog.db hasn't been created yet (no ingest has run). */
  available: boolean;
  sources: {
    code: string;
    name: string;
    record: boolean;
    build: boolean;
    runs: number;
    failed: number;
    records: number;
    inserted: number;
    bytes: number;
    lastRunAt: number | null;
    lastStatus: string | null;
    lastError: string | null;
  }[];
  days: { day: string; runs: number; failed: number; records: number; inserted: number; bytes: number }[];
  shards: { kind: string; lod: number | null; status: string; shards: number; rows: number; bytes: number }[];
  /** Row counts of history.db's main tables. */
  history: { table: string; rows: number }[];
};

export type AnalyticsSystem = {
  now: number;
  startedAt: number;
  node: string;
  platform: string;
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number };
  host: { cpus: number; load: number[]; totalMemory: number; freeMemory: number };
  eventLoopLagMs: number | null;
  /** The api's own HTTP traffic since it started, by route group. */
  http: { group: string; requests: number; errors: number; p50Ms: number | null; p95Ms: number | null }[];
  jobs: { kind: string; pending: number; failed: number; done: number; lastDoneAt: number | null; lastError: string | null }[];
  backups: { count: number; bytes: number; latest: { name: string; bytes: number; at: number } | null } | null;
  reports: { open: number; resolved: number; days: { day: string; created: number }[] };
  audit: { days: { day: string; events: number }[]; actions: { action: string; events: number }[] };
  workspaces: { total: number; createdInRange: number };
};

/** GET /api/admin/users?days=&sort=: the range's activity on each row of the Users table. */
export type UserSort = 'joined' | 'minutes' | 'lastActive' | 'api' | 'signIns';

export type UserActivitySummary = {
  minutes: number;
  activeDays: number;
  /** Last day with map minutes, over everything kept rather than just the range. */
  lastActiveDay: string | null;
  /** Their busiest 'panel:' (not 'panel:none') and 'layer:' features in the range. */
  topPanel: string | null;
  topLayer: string | null;
  apiRequests: number;
  apiDenied: number;
  signIns: number;
  /** Latest of a session's last use, a sign-in and a map minute. */
  lastSeenAt: number | null;
  lastUserAgent: string | null;
  lastIp: string | null;
  /** Where lastIp is, when it can be placed. */
  lastPlace: Omit<PlaceBrief, 'ip'> | null;
  /** Their latest shared location, if they ever used theirs on the map. */
  lastDevice: DeviceBrief | null;
  /** Active (not revoked, not expired) API keys, and workspaces not deleted. */
  keys: number;
  workspaces: number;
};

/** GET /api/admin/analytics/users/:id?days=: everything one account did. Visitors before signing in can't be tied to it. */
export type UserAnalytics = AnalyticsRange & {
  days: number;
  totals: {
    minutes: number;
    activeDays: number;
    avgMinutesPerActiveDay: number;
    /** Over everything kept. */
    firstActiveDay: string | null;
    lastActiveDay: string | null;
    apiRequests: number;
    apiDenied: number;
    apiBytes: number;
    signIns: number;
  };
  /** Every day in the range; `views` holds the 'view:' features' minutes. */
  daily: { day: string; minutes: number; views: Record<string, number>; apiRequests: number; apiDenied: number; signIns: number }[];
  /** Every feature with minutes in the range (all prefixes), and on how many days. */
  features: { feature: string; minutes: number; days: number }[];
  /** Their minutes by UTC weekday (0 = Sunday) and hour; only cells with minutes. */
  hours: { dow: number; hour: number; minutes: number }[];
  api: {
    groups: { group: string; requests: number; denied: number; bytes: number }[];
    /** Every key they have had, with its traffic in the range. */
    keys: { keyId: string; prefix: string | null; name: string | null; requests: number; denied: number; bytes: number; lastUsedAt: number | null; revokedAt: number | null }[];
  };
  /** Newest first, at most 200; kept for the activity retention (90 days by default). The place is looked up from the address when read. */
  signIns: { at: number; ipAddress: string | null; userAgent: string | null; impersonatedBy: string | null; impersonatorEmail: string | null; place: Omit<PlaceBrief, 'ip'> | null }[];
  workspaces: { id: string; name: string; visibility: string; createdAt: number; updatedAt: number; deletedAt: number | null }[];
  reports: { id: number; createdAt: number; status: string; message: string }[];
  /** Browsers (visitor ids) this account signed in on, with the minutes they spent there signed out, over everything kept. */
  browsers: (VisitorProfile & { minutes: number; activeDays: number })[];
  /** Addresses the account used the map from, most recent first. */
  places: Place[];
  /** Locations they shared, most recent first. */
  devicePlaces: DevicePlace[];
  /** Their actions in the range, with on how many days. */
  actions: { action: string; count: number; days: number }[];
};

/*
 * Visitors: browsers that keep a random id (localStorage 'takip.visitor') and send it with the map's minute tick.
 * Minutes here are signed-out time only; an account's own time is under Users. Browsers that block storage aren't here,
 * but Audience's daily visitor counts (a hash of the address block) still include them.
 */
export type VisitorProfile = {
  visitorId: string;
  firstSeenAt: number;
  lastSeenAt: number;
  userAgent: string | null;
  /** First visit: the other site that sent it (host), and the path it landed on with only utm_*, ref, source and w kept. */
  referrer: string | null;
  landing: string | null;
  /** The account last signed in from this browser. */
  user: { id: string; email: string; name: string } | null;
  linkedAt: number | null;
  /** The address it last used the map from, and where that is. */
  place: PlaceBrief | null;
  /** The latest location this browser shared, if any. */
  device: DeviceBrief | null;
};

/** GET /api/admin/analytics/visitors?days=: browsers over the range. */
export type AnalyticsVisitors = AnalyticsRange & {
  /** First day any visitor id was seen. */
  daily: { day: string; visitors: number; new: number; returning: number; minutes: number; signedIn: number }[];
  totals: {
    visitors: number;
    new: number;
    /** First seen before the range; `new` + `returning` = `visitors`, as in `daily`. */
    returning: number;
    /** Linked to an account (signed in on that browser) at any time. */
    signedIn: number;
    minutes: number;
    avgMinutesPerVisitorDay: number;
    /** Hit their network's daily limit in the range. */
    hitWall: number;
  };
  /** First-visit attribution of visitors first seen in the range; referrer null means typed, bookmarked or hidden. */
  referrers: { referrer: string | null; visitors: number; signedIn: number }[];
  landings: { landing: string; visitors: number }[];
  campaigns: { source: string; visitors: number; signedIn: number }[];
  devices: { kind: 'browser' | 'os' | 'device'; name: string; visitors: number }[];
  /** Visitors active in the range by where they used the map from (place_seen); one visitor can be in several. */
  countries: { country: string; visitors: number; signedIn: number }[];
  cities: { country: string; region: string | null; city: string; visitors: number }[];
  /** One point per placed visitor, for a map; at most 2000. Their latest shared location when they have one, else their IP place.
   * Countries and cities stay IP-only: shared labels aren't normalised to ISO codes. */
  points: { latitude: number; longitude: number; visitors: number }[];
  /** Weekly first-seen cohorts (Monday UTC), last 8: share with signed-out minutes in week +0…+7, null for unmeasured weeks. */
  cohorts: { week: string; size: number; retained: (number | null)[] }[];
};

export type VisitorSort = 'lastSeen' | 'firstSeen' | 'minutes' | 'activeDays';

/** GET /api/admin/analytics/visitors/list?days=&sort=&q=&offset=&limit=: q matches an id prefix or a linked account's email. */
export type VisitorList = {
  total: number;
  days: number;
  sort: VisitorSort;
  visitors: (VisitorProfile & { minutes: number; activeDays: number; topPanel: string | null; topLayer: string | null; hitWall: boolean })[];
};

/** GET /api/admin/analytics/visitors/:id?days=: one browser's signed-out activity. */
export type VisitorAnalytics = AnalyticsRange & {
  days: number;
  visitor: VisitorProfile;
  totals: { minutes: number; activeDays: number; avgMinutesPerActiveDay: number; firstActiveDay: string | null; lastActiveDay: string | null; wallDays: number };
  daily: { day: string; minutes: number; views: Record<string, number> }[];
  features: { feature: string; minutes: number; days: number }[];
  hours: { dow: number; hour: number; minutes: number }[];
  /** Every address this browser used, most recent first. */
  places: Place[];
  /** Locations this browser shared, most recent first. */
  devicePlaces: DevicePlace[];
  actions: { action: string; count: number; days: number }[];
};

/** GET /api/admin/analytics/pages (apps/api analytics/pages.ts): the public reading pages. */
export interface AnalyticsPages {
  today: string;
  since: string | null;
  totals: { views: number; readers: number; pages: number; toMap: number };
  daily: { day: string; views: number; readers: number }[];
  pages: { path: string; views: number; readers: number; toMap: number }[];
  sections: { section: string; views: number; readers: number }[];
  referrers: { referrer: string | null; views: number; readers: number }[];
  locales: { locale: string; views: number }[];
}
