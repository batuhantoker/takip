/** What a public profile says about its owner, from the platform's API or the page's own metadata. */
export interface ProfileFacts {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar?: string;
  /** ISO date the account was made, when the platform says. */
  joined?: string;
  /** Profiles and sites this one points to. */
  links: string[];
  /** Links the platform itself checked: a Keybase proof, a Mastodon verified field, a Gravatar verified account. */
  verified: string[];
  emails: string[];
  via: 'api' | 'page';
}

export const emptyFacts = (via: ProfileFacts['via']): ProfileFacts => ({ links: [], verified: [], emails: [], via });

const clean = (s: unknown, max = 280): string | undefined => {
  if (typeof s !== 'string') return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Normalises the loose fields an extractor fills, dropping empties and duplicates. */
export function tidyFacts(f: ProfileFacts): ProfileFacts {
  const uniq = (xs: string[]) => [...new Set(xs.map(x => x.trim()).filter(Boolean))].slice(0, 40);
  const website = clean(f.website, 300);
  return {
    name: clean(f.name, 120),
    bio: clean(f.bio),
    location: clean(f.location, 120),
    website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
    avatar: f.avatar && /^https:\/\//i.test(f.avatar) ? f.avatar : undefined,
    joined: f.joined,
    links: uniq(f.links),
    verified: uniq(f.verified),
    emails: uniq(f.emails.map(e => e.toLowerCase())),
    via: f.via,
  };
}

/** API facts win field by field; the page fills what the API left out. Lists are unioned. */
export function mergeFacts(primary: ProfileFacts | undefined, fallback: ProfileFacts | undefined): ProfileFacts | undefined {
  if (!primary) return fallback;
  if (!fallback) return primary;
  return tidyFacts({
    name: primary.name ?? fallback.name,
    bio: primary.bio ?? fallback.bio,
    location: primary.location ?? fallback.location,
    website: primary.website ?? fallback.website,
    avatar: primary.avatar ?? fallback.avatar,
    joined: primary.joined ?? fallback.joined,
    links: [...primary.links, ...fallback.links],
    verified: [...primary.verified, ...fallback.verified],
    emails: [...primary.emails, ...fallback.emails],
    via: primary.via,
  });
}

export const hasFacts = (f: ProfileFacts | undefined): f is ProfileFacts =>
  !!f && !!(f.name || f.bio || f.location || f.website || f.avatar || f.links.length || f.verified.length || f.emails.length);

/** Seconds or milliseconds since the epoch, or a date string, as an ISO date. */
export function isoDate(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}
