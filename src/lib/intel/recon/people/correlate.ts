import { isPlatformLink, parseHandle, profileKey } from './handles';
import type { ProfileFacts } from './facts';
import { hamming, SAME_PHOTO } from './photo-hash';

/**
 * Which of the profiles a username sweep found belong to the same person.
 *
 * A handle existing on two sites says nothing on its own: common handles are
 * held by different people everywhere. Evidence is what ties profiles
 * together, strongest first: a link the platform verified (a Keybase proof, a
 * Mastodon verified field), a link the owner wrote, the same photo, the same
 * full name, the same personal website. Profiles joined by any of these form
 * groups; the strongest group is taken to be the person searched for.
 */

export type MatchTier = 'confirmed' | 'linked' | 'likely' | 'unknown' | 'other';

export interface ProfileInput {
  site: string;
  url: string;
  facts?: ProfileFacts;
  /** dHash of the profile picture. */
  photo?: string;
}

export interface Match {
  tier: MatchTier;
  reasons: string[];
}

export interface Fact {
  value: string;
  sites: string[];
}

export interface Account {
  label: string;
  handle: string;
  url: string;
  sites: string[];
  verified: boolean;
}

export interface Identity {
  /** Sites in the main group, strongest first. Empty when no two profiles are tied together. */
  cluster: string[];
  /** False when nothing tied the profiles together, so the details below may be several people's. */
  tied: boolean;
  names: Fact[];
  locations: Fact[];
  bios: Fact[];
  websites: Fact[];
  emails: Fact[];
  /** Profiles the group points at that the sweep didn't confirm: another handle, or a site it couldn't check. */
  accounts: Account[];
}

type Kind = 'proof' | 'link' | 'photo' | 'name' | 'website';
const WEIGHT: Record<Kind, number> = { proof: 3, link: 2, photo: 1.5, name: 1, website: 1 };
const ORDER: Kind[] = ['proof', 'link', 'photo', 'name', 'website'];

interface Edge {
  a: number;
  b: number;
  kind: Kind;
  /** For proof and link: the profile that made the claim. */
  from?: number;
}

/* ── names ───────────────────────────────────────────────────── */

const NOT_A_NAME = /\b(profile|user|member|account|official|channel|admin|team|support|bot|page)\b/i;

export function normName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const letters = (s: string) => s.toLowerCase().replace(/[^\p{L}]/gu, '');

/** The tokens of a full name, or null for a single word, the handle itself, or anything that isn't a name. */
function fullName(name: string | undefined, handle: string): string[] | null {
  if (!name) return null;
  const n = normName(name);
  // A display name that is just the handle respelled ("linus_torvalds") adds nothing to the handle match.
  if (!n || letters(n) === letters(handle) || NOT_A_NAME.test(n)) return null;
  const tokens = n.split(' ').filter(t => t.length > 1);
  return tokens.length >= 2 && tokens.length <= 5 ? tokens : null;
}

/**
 * Same person by name: every token of the shorter name appears in the
 * longer, and at least two do. A first name may be the short form of the
 * other's ("Chris" and "Christopher Coyne"); surnames must match exactly.
 */
function sameName(a: string[], b: string[]): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 2) return false;
  const [first, ...rest] = short;
  const set = new Set(long);
  const firstMatches = set.has(first) || (first.length >= 3 && (long[0].startsWith(first) || first.startsWith(long[0])));
  return firstMatches && rest.every(t => set.has(t));
}

/* ── links ───────────────────────────────────────────────────── */

// Shared links to big content hosts (a video, a Discord server) don't say two profiles are one person.
const SHARED_HOSTS = /^url:(youtube\.com|youtu\.be|discord\.gg|discord\.com|open\.spotify\.com|music\.apple\.com|apps\.apple\.com|play\.google\.com|amazon\.[a-z.]+|[a-z]{2}\.wikipedia\.org|bit\.ly|t\.co|google\.com|forms\.gle)(\/|$)/;

function personalKeys(f: ProfileFacts | undefined, foundKeys: Map<string, number>): Map<string, string> {
  const out = new Map<string, string>();
  if (!f) return out;
  for (const url of [f.website, ...f.links, ...f.verified]) {
    if (!url || isPlatformLink(url)) continue;
    const k = profileKey(url);
    if (!k || foundKeys.has(k) || SHARED_HOSTS.test(k)) continue;
    // A bare domain and its homepage are the same site.
    out.set(k.replace(/\/(index\.html?)?$/, ''), url);
  }
  return out;
}

/* ── grouping ────────────────────────────────────────────────── */

function components(n: number, edges: Edge[]): number[][] {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const e of edges) parent[find(e.a)] = find(e.b);
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  }
  return [...groups.values()];
}

const listSites = (sites: string[]) => (sites.length <= 3 ? sites.join(', ') : `${sites.slice(0, 3).join(', ')} and ${sites.length - 3} more`);

function reasonsFor(i: number, edges: Edge[], profiles: ProfileInput[]): string[] {
  const buckets = new Map<string, string[]>();
  const add = (label: string, site: string) => {
    const list = buckets.get(label) ?? [];
    if (!list.includes(site)) list.push(site);
    buckets.set(label, list);
  };
  for (const kind of ORDER) {
    for (const e of edges) {
      if (e.kind !== kind || (e.a !== i && e.b !== i)) continue;
      const other = profiles[e.a === i ? e.b : e.a].site;
      const claimer = e.from === i;
      if (kind === 'proof') add(claimer ? 'Verifies' : 'Verified by', other);
      else if (kind === 'link') add(claimer ? 'Links to' : 'Linked from', other);
      else if (kind === 'photo') add('Same photo as', other);
      else if (kind === 'name') add('Same name as', other);
      else add('Same website as', other);
    }
  }
  return [...buckets].map(([label, sites]) => `${label} ${listSites(sites)}`).slice(0, 3);
}

/** Groups spellings of one value, keeping the commonest spelling and every site that said it. */
function group(items: { key: string; value: string; site: string }[], limit: number): Fact[] {
  const map = new Map<string, { values: Map<string, number>; sites: string[] }>();
  for (const it of items) {
    const g = map.get(it.key) ?? { values: new Map<string, number>(), sites: [] as string[] };
    g.values.set(it.value, (g.values.get(it.value) ?? 0) + 1);
    if (!g.sites.includes(it.site)) g.sites.push(it.site);
    map.set(it.key, g);
  }
  return [...map.values()]
    .map(g => ({ value: [...g.values].sort((a, b) => b[1] - a[1])[0][0], sites: g.sites }))
    .sort((a, b) => b.sites.length - a.sites.length)
    .slice(0, limit);
}

/* ── entry point ─────────────────────────────────────────────── */

export function correlate(handle: string, profiles: ProfileInput[]): { matches: Record<string, Match>; identity: Identity } {
  const n = profiles.length;
  const keys = profiles.map(p => profileKey(p.url));
  const foundKeys = new Map<string, number>();
  keys.forEach((k, i) => { if (k && !foundKeys.has(k)) foundKeys.set(k, i); });

  const edges: Edge[] = [];
  const seen = new Set<string>();
  const addEdge = (a: number, b: number, kind: Kind, from?: number) => {
    if (a === b) return;
    const id = `${Math.min(a, b)}-${Math.max(a, b)}-${kind}-${from ?? ''}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ a, b, kind, from });
  };

  const names = profiles.map(p => fullName(p.facts?.name, handle));
  const personal = profiles.map(p => personalKeys(p.facts, foundKeys));

  for (let i = 0; i < n; i++) {
    const f = profiles[i].facts;
    if (!f) continue;
    const verified = new Set(f.verified.map(profileKey));
    for (const url of [...f.verified, ...f.links, ...(f.website ? [f.website] : [])]) {
      const j = foundKeys.get(profileKey(url) ?? '');
      if (j !== undefined) addEdge(i, j, verified.has(profileKey(url)) ? 'proof' : 'link', i);
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pi = profiles[i], pj = profiles[j];
      if (pi.photo && pj.photo && hamming(pi.photo, pj.photo) <= SAME_PHOTO) addEdge(i, j, 'photo');
      if (names[i] && names[j] && sameName(names[i]!, names[j]!)) addEdge(i, j, 'name');
      if ([...personal[i].keys()].some(k => personal[j].has(k))) addEdge(i, j, 'website');
    }
  }

  const groups = components(n, edges)
    .filter(g => g.length >= 2)
    .map(g => {
      const inside = new Set(g);
      const score = edges.filter(e => inside.has(e.a)).reduce((s, e) => s + WEIGHT[e.kind], 0);
      return { members: g, score };
    })
    .sort((a, b) => b.score - a.score || b.members.length - a.members.length);

  const primary = new Set(groups[0]?.members ?? []);
  const primaryNames = [...primary].map(i => names[i]).filter((x): x is string[] => !!x);

  const matches: Record<string, Match> = {};
  for (let i = 0; i < n; i++) {
    const site = profiles[i].site;
    const mine = edges.filter(e => e.a === i || e.b === i);
    if (primary.has(i)) {
      const tier: MatchTier = mine.some(e => e.kind === 'proof') ? 'confirmed' : mine.some(e => e.kind === 'link') ? 'linked' : 'likely';
      matches[site] = { tier, reasons: reasonsFor(i, edges, profiles) };
      continue;
    }
    const own = groups.find(g => g.members.includes(i));
    if (own) {
      const others = own.members.filter(j => j !== i).map(j => profiles[j].site);
      matches[site] = { tier: 'other', reasons: [`Tied to ${listSites(others)}, not to the main group`, ...reasonsFor(i, edges, profiles)].slice(0, 3) };
      continue;
    }
    if (names[i] && primaryNames.length && !primaryNames.some(pn => sameName(pn, names[i]!))) {
      matches[site] = { tier: 'other', reasons: [`Different name: ${profiles[i].facts!.name}`] };
      continue;
    }
    matches[site] = { tier: 'unknown', reasons: [profiles[i].facts ? 'Nothing ties it to the others' : 'No public details to compare'] };
  }

  const order: Record<Kind, number> = { proof: 0, link: 1, photo: 2, name: 3, website: 4 };
  const strength = (i: number) => Math.min(...edges.filter(e => e.a === i || e.b === i).map(e => order[e.kind]), 9);
  const cluster = [...primary].sort((a, b) => strength(a) - strength(b)).map(i => profiles[i].site);

  const pool = primary.size ? [...primary] : profiles.map((_, i) => i);
  const identity: Identity = {
    cluster,
    tied: primary.size > 0,
    ...summarise(pool, profiles, handle, foundKeys),
  };
  return { matches, identity };
}

function summarise(pool: number[], profiles: ProfileInput[], handle: string, foundKeys: Map<string, number>) {
  const name: { key: string; value: string; site: string }[] = [];
  const location: typeof name = [];
  const bio: typeof name = [];
  const website: typeof name = [];
  const email: typeof name = [];
  const accounts = new Map<string, Account>();

  for (const i of pool) {
    const { site, facts: f } = profiles[i];
    if (!f) continue;
    if (f.name) {
      const tokens = fullName(f.name, handle);
      const key = tokens ? [...tokens].sort().join(' ') : normName(f.name);
      if (key && letters(key) !== letters(handle)) name.push({ key, value: f.name, site });
    }
    if (f.location) location.push({ key: normName(f.location), value: f.location, site });
    if (f.bio) bio.push({ key: f.bio.toLowerCase(), value: f.bio, site });
    for (const [key, url] of personalKeys(f, foundKeys)) website.push({ key, value: url, site });
    for (const e of f.emails) email.push({ key: e, value: e, site });

    const verified = new Set(f.verified.map(profileKey));
    for (const url of [...f.verified, ...f.links]) {
      const h = parseHandle(url);
      const key = profileKey(url);
      if (!h || !key || foundKeys.has(key)) continue;
      const a = accounts.get(key) ?? { label: h.label, handle: h.handle, url, sites: [], verified: false };
      if (!a.sites.includes(site)) a.sites.push(site);
      a.verified ||= verified.has(key);
      accounts.set(key, a);
    }
  }

  return {
    names: group(name, 5),
    locations: group(location, 5),
    bios: group(bio, 3),
    websites: group(website, 8),
    emails: group(email, 8),
    accounts: [...accounts.values()]
      .sort((a, b) => Number(b.verified) - Number(a.verified) || b.sites.length - a.sites.length)
      .slice(0, 24),
  };
}
