import { emailsInText, hrefsIn, htmlToText, urlsInText } from './handles';
import { emptyFacts, hasFacts, isoDate, tidyFacts, type ProfileFacts } from './facts';
import { isPlaceholderImage } from './page';

/**
 * Profile details from platforms with a public, keyless JSON API. Each
 * parser is pure (payload in, facts out) so it can be tested on captured
 * payloads; `extractProfile` does the fetching. Keyed by the Sherlock site
 * name the username sweep reports.
 */

// Upstream payloads are unvalidated JSON; each parser reads only the fields it knows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const s = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const avatar = (v: unknown) => { const u = s(v); return u && !isPlaceholderImage(u) ? u : undefined; };
const textLinks = (text: string | undefined) => (text ? urlsInText(text) : []);

export function parseGithub(u: Json, social: Json[] = []): ProfileFacts {
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(u.name),
    bio: s(u.bio),
    location: s(u.location),
    website: s(u.blog),
    avatar: s(u.avatar_url),
    joined: isoDate(u.created_at),
    links: [
      ...(s(u.twitter_username) ? [`https://x.com/${u.twitter_username}`] : []),
      ...social.map(a => s(a?.url)).filter((x): x is string => !!x),
      ...textLinks(u.bio),
    ],
    emails: s(u.email) ? [u.email] : [],
  });
}

export function parseGitlab(u: Json): ProfileFacts {
  const handleLinks = [
    s(u.twitter) && `https://x.com/${u.twitter}`,
    s(u.linkedin) && (/^https?:/.test(u.linkedin) ? u.linkedin : `https://www.linkedin.com/in/${u.linkedin}`),
    s(u.github) && `https://github.com/${u.github}`,
    s(u.bluesky) && `https://bsky.app/profile/${u.bluesky}`,
    s(u.mastodon) && /^https?:/.test(u.mastodon) && u.mastodon,
  ].filter((x): x is string => !!x);
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(u.name),
    bio: s(u.bio),
    location: s(u.location),
    website: s(u.website_url),
    avatar: avatar(u.avatar_url),
    joined: isoDate(u.created_at),
    links: [...handleLinks, ...textLinks(u.bio)],
    emails: s(u.public_email) ? [u.public_email] : [],
  });
}

export function parseKeybase(json: Json): ProfileFacts | null {
  const them = Array.isArray(json?.them) ? json.them[0] : null;
  if (!them) return null;
  const proofs: Json[] = Array.isArray(them.proofs_summary?.all) ? them.proofs_summary.all : [];
  // state 1 is a live proof; revoked or broken ones prove nothing.
  const live = proofs.filter(p => p?.state === 1 || p?.state === undefined);
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(them.profile?.full_name),
    bio: s(them.profile?.bio),
    location: s(them.profile?.location),
    avatar: avatar(them.pictures?.primary?.url),
    joined: isoDate(them.basics?.ctime),
    verified: live.map(p => s(p.service_url)).filter((x): x is string => !!x),
    links: textLinks(them.profile?.bio),
  });
}

export function parseGravatar(g: Json): ProfileFacts | null {
  if (!g || (!g.display_name && !g.profile_url)) return null;
  const verified = (Array.isArray(g.verified_accounts) ? g.verified_accounts : [])
    .filter((a: Json) => !a?.is_hidden)
    .map((a: Json) => s(a?.url))
    .filter((x: string | undefined): x is string => !!x);
  const links = (Array.isArray(g.links) ? g.links : []).map((l: Json) => s(l?.url)).filter((x: string | undefined): x is string => !!x);
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(g.display_name),
    bio: s(g.description),
    location: s(g.location),
    // The avatar URL is derived from the email hash, so a missing picture still returns one: the default.
    avatar: g.avatar_url ? `${g.avatar_url}?d=404&s=256` : undefined,
    links: [...links, ...(s(g.profile_url) ? [g.profile_url] : []), ...textLinks(g.description)],
    verified,
    emails: Array.isArray(g.emails) ? g.emails.map((e: Json) => s(e?.value)).filter((x: string | undefined): x is string => !!x) : [],
  });
}

export function parseLichess(u: Json): ProfileFacts {
  const p = u.profile ?? {};
  const name = s(p.realName) ?? ([p.firstName, p.lastName].filter(Boolean).join(' ') || undefined);
  return tidyFacts({
    ...emptyFacts('api'),
    name,
    bio: s(p.bio),
    location: s(p.location) ?? s(p.flag) ?? s(p.country),
    joined: isoDate(u.createdAt),
    links: [...(s(p.links) ? p.links.split(/\s+/) : []), ...textLinks(p.bio),
      ...Object.values(u.streamer ?? {}).map(x => s((x as Json)?.channel)).filter((x): x is string => !!x)],
  });
}

export function parseChess(u: Json): ProfileFacts {
  // "https://api.chess.com/pub/country/US"
  const country = s(u.country)?.split('/').pop();
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(u.name),
    location: [s(u.location), country].filter(Boolean).join(', ') || undefined,
    avatar: avatar(u.avatar),
    joined: isoDate(u.joined),
    links: [s(u.twitch_url)].filter((x): x is string => !!x),
  });
}

export function parseDevto(u: Json): ProfileFacts {
  // DEV signs people in with GitHub or X, so these two names come from the
  // OAuth identity rather than a field anyone can type into.
  const verified = [
    s(u.github_username) && `https://github.com/${u.github_username}`,
    s(u.twitter_username) && `https://x.com/${u.twitter_username}`,
  ].filter((x): x is string => !!x);
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(u.name),
    bio: s(u.summary),
    location: s(u.location),
    website: s(u.website_url),
    avatar: avatar(u.profile_image),
    joined: isoDate(u.joined_at),
    verified,
    links: textLinks(u.summary),
  });
}

export function parseBluesky(p: Json): ProfileFacts {
  const handle = s(p.handle);
  // A handle that is a domain was verified by that domain's DNS or well-known file.
  const domain = handle && !handle.endsWith('.bsky.social') ? `https://${handle}` : undefined;
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(p.displayName),
    bio: s(p.description),
    avatar: avatar(p.avatar),
    joined: isoDate(p.createdAt),
    verified: domain ? [domain] : [],
    links: textLinks(p.description),
    emails: emailsInText(p.description ?? ''),
  });
}

export function parseMastodon(a: Json): ProfileFacts {
  const fields: Json[] = Array.isArray(a.fields) ? a.fields : [];
  const verified = fields.filter(f => f?.verified_at).flatMap(f => hrefsIn(String(f.value ?? '')));
  const unverified = fields.filter(f => !f?.verified_at).flatMap(f => hrefsIn(String(f.value ?? '')));
  const note = s(a.note) ? htmlToText(a.note) : undefined;
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(a.display_name),
    bio: note,
    avatar: avatar(a.avatar),
    joined: isoDate(a.created_at),
    verified,
    // Mentions and hashtags in a note point at other accounts and topics, not at the owner.
    links: [...unverified, ...hrefsIn(String(a.note ?? '')).filter(h => !/\/@[^/]+\/?$|\/tags\//.test(h))],
    emails: emailsInText(note ?? ''),
  });
}

export function parseHackerNews(u: Json): ProfileFacts | null {
  if (!u?.id) return null;
  const about = s(u.about) ? htmlToText(u.about) : undefined;
  return tidyFacts({
    ...emptyFacts('api'),
    bio: about,
    joined: isoDate(u.created),
    links: [...hrefsIn(String(u.about ?? '')), ...textLinks(about)],
    emails: emailsInText(about ?? ''),
  });
}

export function parseDockerHub(u: Json): ProfileFacts {
  return tidyFacts({
    ...emptyFacts('api'),
    name: s(u.full_name),
    location: s(u.location),
    website: s(u.profile_url),
    avatar: avatar(u.gravatar_url),
    joined: isoDate(u.date_joined),
  });
}

/* ── fetching ────────────────────────────────────────────────── */

export interface FetchOpts {
  timeoutMs: number;
  signal?: AbortSignal;
}

async function getJson(url: string, opts: FetchOpts, headers: Record<string, string> = {}): Promise<Json | null> {
  const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeoutMs)]) : AbortSignal.timeout(opts.timeoutMs);
  const res = await fetch(url, { signal, headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', ...headers } });
  // Rate limits and refusals mean "no details", never a wrong answer.
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return { 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const enc = encodeURIComponent;

type Extractor = (handle: string, opts: FetchOpts) => Promise<ProfileFacts | null>;

export const EXTRACTORS: Record<string, Extractor> = {
  GitHub: async (h, o) => {
    const [user, social] = await Promise.all([
      getJson(`https://api.github.com/users/${enc(h)}`, o, githubHeaders()),
      getJson(`https://api.github.com/users/${enc(h)}/social_accounts`, o, githubHeaders()),
    ]);
    return user ? parseGithub(user, Array.isArray(social) ? social : []) : null;
  },
  GitLab: async (h, o) => {
    const list = await getJson(`https://gitlab.com/api/v4/users?username=${enc(h)}`, o);
    const id = Array.isArray(list) ? list[0]?.id : undefined;
    if (!id) return null;
    return parseGitlab((await getJson(`https://gitlab.com/api/v4/users/${id}`, o)) ?? list![0]);
  },
  Keybase: async (h, o) => {
    const j = await getJson(`https://keybase.io/_/api/1.0/user/lookup.json?usernames=${enc(h)}&fields=basics,profile,proofs_summary,pictures`, o);
    return j ? parseKeybase(j) : null;
  },
  Gravatar: async (h, o) => {
    const j = await getJson(`https://api.gravatar.com/v3/profiles/${enc(h)}`, o);
    return j ? parseGravatar(j) : null;
  },
  Lichess: async (h, o) => {
    const j = await getJson(`https://lichess.org/api/user/${enc(h)}`, o);
    return j ? parseLichess(j) : null;
  },
  Chess: async (h, o) => {
    const j = await getJson(`https://api.chess.com/pub/player/${enc(h.toLowerCase())}`, o);
    return j ? parseChess(j) : null;
  },
  'DEV Community': async (h, o) => {
    const j = await getJson(`https://dev.to/api/users/by_username?url=${enc(h)}`, o);
    return j ? parseDevto(j) : null;
  },
  Bluesky: async (h, o) => {
    const j = await getJson(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${enc(h)}.bsky.social`, o);
    return j ? parseBluesky(j) : null;
  },
  'mastodon.social': async (h, o) => {
    const j = await getJson(`https://mastodon.social/api/v1/accounts/lookup?acct=${enc(h)}`, o);
    return j ? parseMastodon(j) : null;
  },
  HackerNews: async (h, o) => {
    const j = await getJson(`https://hacker-news.firebaseio.com/v0/user/${enc(h)}.json`, o);
    return j ? parseHackerNews(j) : null;
  },
  'Docker Hub': async (h, o) => {
    const j = await getJson(`https://hub.docker.com/v2/users/${enc(h)}/`, o);
    return j ? parseDockerHub(j) : null;
  },
};

/** API facts for a found profile, or null when the platform has no extractor or didn't answer. */
export async function extractProfile(site: string, handle: string, opts: FetchOpts): Promise<ProfileFacts | null> {
  const extractor = EXTRACTORS[site];
  if (!extractor) return null;
  try {
    const facts = await extractor(handle, opts);
    return hasFacts(facts ?? undefined) ? facts : null;
  } catch {
    return null;
  }
}
