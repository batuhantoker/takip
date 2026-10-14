/**
 * Turns profile URLs into comparable keys. A link from one profile and a
 * profile the username sweep found must compare equal however each site
 * spells the address (www, trailing slash, x.com vs twitter.com), so both are
 * reduced to `platform:handle` where the platform is known, and to a bare
 * host + path otherwise.
 */

export interface Handle {
  platform: string;
  label: string;
  handle: string;
}

interface Platform {
  id: string;
  label: string;
  host: RegExp;
  /** Matched against the pathname; group 1 is the handle. */
  path?: RegExp;
  /** The handle is this query parameter instead. */
  query?: string;
  /** The handle is the subdomain (name.tumblr.com). */
  sub?: boolean;
  /** Words that sit where a handle would but are the site's own pages. */
  reserved?: string[];
}

const PLATFORMS: Platform[] = [
  { id: 'github', label: 'GitHub', host: /^github\.com$/, path: /^\/([a-z0-9-]{1,39})\/?$/i,
    reserved: ['about', 'features', 'pricing', 'orgs', 'settings', 'login', 'join', 'marketplace', 'explore', 'topics', 'sponsors', 'collections', 'trending', 'enterprise', 'security', 'site', 'apps', 'contact', 'notifications', 'new', 'organizations', 'team', 'readme', 'events', 'codespaces', 'issues', 'pulls', 'search', 'customer-stories', 'home'] },
  { id: 'gitlab', label: 'GitLab', host: /^gitlab\.com$/, path: /^\/([\w.-]{2,255})\/?$/, reserved: ['explore', 'help', 'users', 'dashboard', 'projects', 'groups', 'search', 'admin'] },
  { id: 'twitter', label: 'X', host: /^(twitter|x)\.com$/, path: /^\/([a-z0-9_]{1,15})\/?$/i,
    reserved: ['home', 'explore', 'i', 'intent', 'share', 'search', 'settings', 'login', 'signup', 'tos', 'privacy', 'hashtag', 'notifications', 'messages', 'compose'] },
  { id: 'instagram', label: 'Instagram', host: /^instagram\.com$/, path: /^\/([a-z0-9._]{1,30})\/?$/i,
    reserved: ['p', 'reel', 'reels', 'explore', 'accounts', 'stories', 'direct', 'about', 'developer', 'legal', 'tv'] },
  { id: 'tiktok', label: 'TikTok', host: /^tiktok\.com$/, path: /^\/@([a-z0-9._]{2,24})\/?$/i },
  { id: 'youtube', label: 'YouTube', host: /^youtube\.com$/, path: /^\/(?:@|c\/|user\/)([\w.-]{3,100})\/?$/ },
  { id: 'threads', label: 'Threads', host: /^threads\.(net|com)$/, path: /^\/@([\w.]{1,30})\/?$/ },
  { id: 'reddit', label: 'Reddit', host: /^reddit\.com$/, path: /^\/(?:user|u)\/([\w-]{3,20})\/?/ },
  { id: 'telegram', label: 'Telegram', host: /^(t|telegram)\.me$/, path: /^\/([a-z0-9_]{4,32})\/?$/i, reserved: ['joinchat', 'addstickers', 'share', 'proxy', 'iv', 'socks'] },
  { id: 'linkedin', label: 'LinkedIn', host: /^linkedin\.com$/, path: /^\/in\/([^/]{3,100})\/?$/ },
  { id: 'facebook', label: 'Facebook', host: /^(facebook|fb)\.com$/, path: /^\/([a-z0-9.]{5,50})\/?$/i,
    reserved: ['pages', 'groups', 'events', 'sharer', 'share', 'watch', 'marketplace', 'login', 'help', 'policies', 'profile.php', 'privacy', 'gaming'] },
  { id: 'twitch', label: 'Twitch', host: /^twitch\.tv$/, path: /^\/([a-z0-9_]{3,25})\/?$/i, reserved: ['directory', 'videos', 'p', 'settings', 'downloads', 'jobs', 'search', 'login', 'signup'] },
  { id: 'keybase', label: 'Keybase', host: /^keybase\.io$/, path: /^\/([a-z0-9_]{2,16})\/?$/i, reserved: ['docs', 'download', 'blog', 'team', 'jobs', 'account', '_'] },
  { id: 'hackernews', label: 'Hacker News', host: /^news\.ycombinator\.com$/, query: 'id' },
  { id: 'medium', label: 'Medium', host: /^medium\.com$/, path: /^\/@([\w.-]{1,50})\/?$/ },
  { id: 'devto', label: 'DEV', host: /^dev\.to$/, path: /^\/([a-z0-9_]{2,30})\/?$/i,
    reserved: ['t', 'top', 'latest', 'search', 'settings', 'enter', 'about', 'privacy', 'terms', 'code-of-conduct', 'faq', 'sponsors', 'shop', 'listings', 'videos', 'podcasts', 'tags', 'pod', 'contact', 'mod'] },
  { id: 'lichess', label: 'Lichess', host: /^lichess\.org$/, path: /^\/@\/([\w-]{2,30})\/?$/ },
  { id: 'chess', label: 'Chess.com', host: /^chess\.com$/, path: /^\/member\/([\w-]{3,25})\/?$/ },
  { id: 'bluesky', label: 'Bluesky', host: /^bsky\.app$/, path: /^\/profile\/([\w.-]{3,253})\/?$/ },
  { id: 'linktree', label: 'Linktree', host: /^linktr\.ee$/, path: /^\/([\w.]{2,30})\/?$/ },
  { id: 'codeberg', label: 'Codeberg', host: /^codeberg\.org$/, path: /^\/([\w.-]{2,40})\/?$/, reserved: ['explore', 'user', 'repo', 'org', 'admin'] },
  { id: 'huggingface', label: 'Hugging Face', host: /^huggingface\.co$/, path: /^\/([\w-]{2,42})\/?$/,
    reserved: ['models', 'datasets', 'spaces', 'docs', 'blog', 'pricing', 'login', 'join', 'settings', 'papers', 'learn', 'posts', 'enterprise', 'organizations', 'tasks'] },
  { id: 'dockerhub', label: 'Docker Hub', host: /^hub\.docker\.com$/, path: /^\/u\/([\w-]{2,30})\/?$/ },
  { id: 'steam', label: 'Steam', host: /^steamcommunity\.com$/, path: /^\/id\/([\w-]{2,32})\/?$/ },
  { id: 'soundcloud', label: 'SoundCloud', host: /^soundcloud\.com$/, path: /^\/([\w-]{2,25})\/?$/, reserved: ['discover', 'stream', 'upload', 'you', 'search', 'pages', 'charts', 'mobile', 'terms-of-use'] },
  { id: 'pinterest', label: 'Pinterest', host: /^pinterest\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/, path: /^\/([\w]{3,30})\/?$/, reserved: ['pin', 'search', 'ideas', 'today', 'business', 'settings'] },
  { id: 'patreon', label: 'Patreon', host: /^patreon\.com$/, path: /^\/(?:c\/)?([\w-]{2,64})\/?$/, reserved: ['login', 'signup', 'home', 'explore', 'about', 'posts', 'messages', 'settings', 'search'] },
  { id: 'gravatar', label: 'Gravatar', host: /^(en\.)?gravatar\.com$/, path: /^\/([\w.-]{2,64})\/?$/ },
  { id: 'vk', label: 'VK', host: /^vk\.com$/, path: /^\/([\w.]{2,32})\/?$/, reserved: ['feed', 'im', 'friends', 'groups', 'search', 'settings', 'video', 'audio', 'wall', 'apps', 'login'] },
  { id: 'kaggle', label: 'Kaggle', host: /^kaggle\.com$/, path: /^\/([\w-]{2,40})\/?$/, reserved: ['competitions', 'datasets', 'code', 'discussions', 'learn', 'models', 'docs', 'search', 'settings', 'account', 'contact'] },
  { id: 'behance', label: 'Behance', host: /^behance\.net$/, path: /^\/([\w-]{2,40})\/?$/, reserved: ['galleries', 'search', 'joblist', 'hire', 'assets'] },
  { id: 'dribbble', label: 'Dribbble', host: /^dribbble\.com$/, path: /^\/([\w-]{2,40})\/?$/, reserved: ['shots', 'designers', 'jobs', 'tags', 'search', 'signup', 'session', 'pro', 'learn', 'hiring', 'about'] },
  { id: 'npm', label: 'npm', host: /^npmjs\.com$/, path: /^\/~([\w.-]{1,214})\/?$/ },
  { id: 'pypi', label: 'PyPI', host: /^pypi\.org$/, path: /^\/user\/([\w.-]{1,50})\/?$/ },
  { id: 'snapchat', label: 'Snapchat', host: /^snapchat\.com$/, path: /^\/add\/([\w.-]{3,15})\/?$/ },
  { id: 'aboutme', label: 'About.me', host: /^about\.me$/, path: /^\/([\w.-]{2,40})\/?$/ },
  { id: 'flickr', label: 'Flickr', host: /^flickr\.com$/, path: /^\/(?:people|photos)\/([\w@-]{2,40})\/?$/ },
  { id: 'vimeo', label: 'Vimeo', host: /^vimeo\.com$/, path: /^\/([a-z][\w]{2,40})\/?$/i,
    reserved: ['channels', 'groups', 'categories', 'watch', 'upload', 'search', 'features', 'solutions', 'blog', 'help', 'join', 'log_in', 'ondemand', 'stock', 'create'] },
  { id: 'replit', label: 'Replit', host: /^replit\.com$/, path: /^\/@([\w-]{2,40})\/?$/ },
  { id: 'hashnode', label: 'Hashnode', host: /^hashnode\.com$/, path: /^\/@([\w-]{2,40})\/?$/ },
  { id: 'lastfm', label: 'Last.fm', host: /^last\.fm$/, path: /^\/user\/([\w-]{2,15})\/?$/ },
  { id: 'kick', label: 'Kick', host: /^kick\.com$/, path: /^\/([\w-]{3,25})\/?$/, reserved: ['categories', 'browse', 'following', 'search', 'terms-of-service', 'privacy-policy'] },
  { id: 'tumblr', label: 'Tumblr', host: /^([a-z0-9-]+)\.tumblr\.com$/, sub: true },
  { id: 'substack', label: 'Substack', host: /^([a-z0-9-]+)\.substack\.com$/, sub: true },
  { id: 'wordpress', label: 'WordPress', host: /^([a-z0-9-]+)\.wordpress\.com$/, sub: true },
  { id: 'blogger', label: 'Blogger', host: /^([a-z0-9-]+)\.blogspot\.com$/, sub: true },
];

const BY_ID = new Map(PLATFORMS.map(p => [p.id, p]));
const SUBDOMAIN_RESERVED = new Set(['www', 'api', 'help', 'blog', 'support', 'status', 'docs', 'assets', 'static', 'mail']);

export function platformLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

function parseUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

const bareHost = (host: string) => host.toLowerCase().replace(/^(www|m|mobile)\./, '');

/** The platform and handle a profile URL points at, or null for anything else. */
export function parseHandle(raw: string): Handle | null {
  const u = parseUrl(raw);
  if (!u) return null;
  const host = bareHost(u.hostname);
  let path = u.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep it encoded */
  }

  for (const p of PLATFORMS) {
    const hm = host.match(p.host);
    if (!hm) continue;
    let handle: string | undefined;
    if (p.sub) {
      if (SUBDOMAIN_RESERVED.has(hm[1]) || (path !== '/' && path !== '')) continue;
      handle = hm[1];
    } else if (p.query) {
      handle = u.searchParams.get(p.query) ?? undefined;
    } else if (p.path) {
      handle = path.match(p.path)?.[1];
    }
    if (!handle || p.reserved?.includes(handle.toLowerCase())) continue;
    if (p.id === 'bluesky') handle = handle.replace(/\.bsky\.social$/i, '');
    return { platform: p.id, label: p.label, handle };
  }

  // Mastodon and the rest of the fediverse share one profile shape on any host.
  const fedi = path.match(/^\/@([a-z0-9_]{1,30})\/?$/i);
  if (fedi && host.includes('.')) return { platform: `fedi:${host}`, label: host, handle: `${fedi[1]}@${host}` };
  return null;
}

/** A key two spellings of the same profile share: `github:octocat`, else host + path. */
export function profileKey(raw: string): string | null {
  const h = parseHandle(raw);
  if (h) return `${h.platform}:${h.handle.toLowerCase()}`;
  const u = parseUrl(raw);
  if (!u) return null;
  const path = u.pathname.replace(/\/+$/, '').toLowerCase();
  return `url:${bareHost(u.hostname)}${path}`;
}

/** True for a link to a profile on a platform we know, as opposed to someone's own site. */
export const isPlatformLink = (raw: string) => parseHandle(raw) !== null;

/* ── text ─────────────────────────────────────────────────────── */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/', '#x2f': '/' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (ENTITIES[e] !== undefined) return ENTITIES[e];
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return m;
  });
}

/** Markup to plain text, keeping line breaks where block tags were. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  ).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Every href in a fragment of markup, decoded. */
export function hrefsIn(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) out.push(decodeEntities(m[1]));
  return out.filter(h => /^https?:\/\//i.test(h));
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/gi;
// Bios often write a profile without the scheme: "github.com/octocat".
const BARE_PROFILE = /(?<![\w./@-])(?:www\.)?(?:github\.com|gitlab\.com|twitter\.com|x\.com|instagram\.com|tiktok\.com|youtube\.com|t\.me|linkedin\.com\/in|keybase\.io|bsky\.app\/profile|twitch\.tv|reddit\.com\/(?:u|user)|medium\.com|linktr\.ee|codeberg\.org)\/[^\s<>"'()]+[^\s<>"'().,;:!?]/gi;

export function urlsInText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(URL_IN_TEXT)) found.add(m[0]);
  for (const m of text.matchAll(BARE_PROFILE)) found.add(`https://${m[0]}`);
  return [...found];
}

const EMAIL_IN_TEXT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}\b/gi;
const NOT_A_PERSON = /^(noreply|no-reply|donotreply|do-not-reply|notifications?|mailer-daemon|postmaster)@|@users\.noreply\.github\.com$|@example\.(com|org|net)$/i;

export function emailsInText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(EMAIL_IN_TEXT)) {
    const e = m[0].toLowerCase();
    // Image names and retina suffixes ("logo@2x.png") look like addresses.
    if (!NOT_A_PERSON.test(e) && !/\.(png|jpe?g|gif|webp|svg)$/.test(e)) found.add(e);
  }
  return [...found];
}
