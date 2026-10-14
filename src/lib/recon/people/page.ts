import { decodeEntities, emailsInText, parseHandle, urlsInText } from './handles';
import { emptyFacts, hasFacts, tidyFacts, type ProfileFacts } from './facts';

/**
 * Reads what a profile page says about its owner from its own metadata:
 * JSON-LD Person, rel="me" links, and Open Graph tags. Regex rather than a
 * DOM, since only the head and a few tags are needed and the pages are
 * whatever the platform serves a bot.
 */

const MAX_HTML = 512 * 1024;

export interface PageMeta {
  title?: string;
  meta: Record<string, string>;
  jsonld: unknown[];
  relMe: string[];
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

export function readMeta(raw: string): PageMeta {
  const html = raw.length > MAX_HTML ? raw.slice(0, MAX_HTML) : raw;
  const meta: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content && !(key in meta)) meta[key] = a.content.trim();
  }

  const jsonld: unknown[] = [];
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonld.push(JSON.parse(m[1].trim()));
    } catch {
      /* malformed blocks are common; skip them */
    }
  }

  const relMe: string[] = [];
  for (const m of html.matchAll(/<(?:a|link)\s[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.href && a.rel && /(^|\s)me(\s|$)/i.test(a.rel) && /^https?:\/\//i.test(a.href)) relMe.push(a.href);
  }

  const title = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1];
  return { title: title ? decodeEntities(title).trim() : undefined, meta, jsonld, relMe };
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

/** The first schema.org Person in a page's JSON-LD, looking through @graph and ProfilePage.mainEntity. */
export function findPerson(blocks: unknown[]): Json | undefined {
  const queue: unknown[] = [...blocks];
  for (let guard = 0; queue.length && guard < 200; guard++) {
    const node = queue.shift();
    if (Array.isArray(node)) { queue.push(...node); continue; }
    if (!isObj(node)) continue;
    const type = node['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.includes('Person')) return node;
    for (const k of ['@graph', 'mainEntity', 'author', 'about']) if (node[k]) queue.push(node[k]);
  }
  return undefined;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s): s is string => !!s) : str(v) ? [str(v)!] : []);
const imageOf = (v: unknown): string | undefined => str(v) ?? (isObj(v) ? str(v.url) ?? str(v.contentUrl) : Array.isArray(v) ? imageOf(v[0]) : undefined);

function placeOf(v: unknown): string | undefined {
  if (str(v)) return str(v);
  if (!isObj(v)) return undefined;
  if (str(v.name)) return str(v.name);
  const parts = [v.addressLocality, v.addressRegion, v.addressCountry].map(p => (isObj(p) ? str(p.name) : str(p))).filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/** Words that mean a page title is the site talking, not a person's name. */
const NOT_A_NAME = /\b(profile|profiles|overview|user|users|member|members|account|page|home|homepage|about|community|forum|forums|login|log in|sign in|sign up|welcome|official|channel|videos?|photos?|posts|not found|404|error|search|settings|dashboard|portfolio|blog|repositories|followers)\b/i;

/**
 * A person's name from a profile page title, or nothing. Titles carry the
 * site's name and the handle around the name ("Linus Torvalds (@torvalds) / X",
 * "torvalds (Linus Torvalds) · GitHub"), so those are stripped and anything
 * that is only the handle or reads like site chrome is refused.
 */
export function nameFromTitle(title: string, handle: string, site: string): string | undefined {
  const h = handle.toLowerCase().replace(/^@/, '');
  const siteWord = site.toLowerCase().replace(/\.(com|org|net|io|me|tv|co)$/, '');
  const esc = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const inner = title.match(new RegExp(`^@?${esc}\\s*\\(([^)]+)\\)`, 'i'));
  const trimmed = title.replace(/\s+on\s+[\p{L}.]+$/u, '');
  const segments = (inner ? [inner[1]] : trimmed.split(/\s+[|•·—–\-/:]\s+|\s*[|•·—–]\s*/))
    .map(s => s.replace(new RegExp(`\\(@?${esc}\\)|@${esc}\\b`, 'ig'), '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim())
    .filter(s => s && !s.toLowerCase().includes(siteWord) && s.toLowerCase().replace(/^@/, '') !== h);

  const candidate = segments[0];
  if (!candidate || candidate.length < 2 || candidate.length > 60) return undefined;
  if (NOT_A_NAME.test(candidate) || /https?:|www\.|\.com\b|[<>{}[\]]/i.test(candidate)) return undefined;
  // "octocat's Applets" is the site describing the account, not a name.
  if (new RegExp(`${esc}['’]s\\b`, 'i').test(candidate)) return undefined;
  if (!/\p{L}/u.test(candidate)) return undefined;
  return candidate;
}

// Default and placeholder pictures say nothing about who owns an account.
const PLACEHOLDER_IMAGE = /default|placeholder|missing|blank|anonymous|no[-_]?avatar|no[-_]?photo|t_logo|silhouette|\/logo|og[-_]image|share[-_]image|favicon/i;
export const isPlaceholderImage = (url: string) => PLACEHOLDER_IMAGE.test(url);

// "11 repositories available", "8 Followers · 2 Following": counts the site writes, not a bio.
const BOILERPLATE = /\b\d[\d,.]*[km]?\s+(followers?|following|posts?|repositories|subscribers|likes|videos)\b|follow their code|see (instagram|tiktok) (photos|videos)|['’]s profile\b|\bprofile on\b/i;
const cleanBio = (bio: string | undefined) => (bio && !BOILERPLATE.test(bio) ? bio : undefined);

/** Platforms whose og: tags describe the profile's owner rather than the site. */
const OG_IS_PROFILE = new Set(['Telegram', 'Linktree', 'Carrd', 'About.me', 'AllMyLinks']);

/** Linktree keeps the whole page as JSON in __NEXT_DATA__, including links its own markup hides. */
function linktree(html: string): Partial<ProfileFacts> | undefined {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return undefined;
  try {
    const pp = JSON.parse(m[1])?.props?.pageProps;
    const account = pp?.account ?? {};
    const urls = [
      ...(Array.isArray(account.socialLinks) ? account.socialLinks : Array.isArray(pp?.socialLinks) ? pp.socialLinks : []),
      ...(Array.isArray(pp?.links) ? pp.links : []),
    ].map((l: Json) => str(l?.url)).filter((u): u is string => !!u && /^https?:\/\//i.test(u));
    return {
      name: str(account.profileTitle) ?? str(account.pageTitle),
      bio: str(account.description) ?? str(pp?.description),
      avatar: str(account.profilePictureUrl),
      links: urls,
    };
  } catch {
    return undefined;
  }
}

const PAGE_PARSERS: Record<string, (html: string) => Partial<ProfileFacts> | undefined> = {
  Linktree: linktree,
};

/** Facts a profile page states about its owner, or undefined when it says nothing usable. */
export function pageFacts(html: string, site: string, handle: string): ProfileFacts | undefined {
  const page = readMeta(html);
  const person = findPerson(page.jsonld);
  const ogProfile = page.meta['og:type'] === 'profile' || OG_IS_PROFILE.has(site);
  const special = PAGE_PARSERS[site]?.(html);

  /* Most sites title every page the same way, and many serve a challenge,
     consent wall or app shell with its own title, so a title is only read
     as a name when it mentions the handle, which site chrome never does.
     Pages that are about one person (og:type profile, a Telegram card) are
     trusted without that. */
  const titles = [page.meta['og:title'], page.meta['twitter:title'], page.title].filter((t): t is string => !!t);
  const title = ogProfile ? titles[0] : titles.find(t => t.toLowerCase().includes(handle.toLowerCase()));
  const name = str(special?.name) ?? str(person?.name) ?? (title ? nameFromTitle(title, handle, site) : undefined);
  const bio = cleanBio(str(special?.bio) ?? str(person?.description) ?? (ogProfile ? page.meta['og:description'] : undefined));
  const image = str(special?.avatar) ?? imageOf(person?.image) ?? (ogProfile ? page.meta['og:image'] : undefined);

  // Sites mark their own official accounts rel="me" in the footer; those name the site, not the person.
  const siteLetters = site.toLowerCase().replace(/\.(com|org|net|io|me|tv|co)$/, '').replace(/[^a-z0-9]/g, '');
  const ownAccount = (url: string) => {
    const h = parseHandle(url)?.handle.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !!h && siteLetters.length >= 3 && (h.includes(siteLetters) || siteLetters.includes(h));
  };
  const links = [...(special?.links ?? []), ...strs(person?.sameAs), ...page.relMe, ...urlsInText(bio ?? '')].filter(u => !ownAccount(u));
  const facts = tidyFacts({
    ...emptyFacts('page'),
    name: name && name.toLowerCase().replace(/^@/, '') !== handle.toLowerCase() ? name : undefined,
    bio,
    location: placeOf(person?.address) ?? placeOf(person?.homeLocation),
    avatar: image && !isPlaceholderImage(image) ? image : undefined,
    links,
    emails: emailsInText(bio ?? ''),
  });
  return hasFacts(facts) ? facts : undefined;
}
