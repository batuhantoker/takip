import { createHash } from 'node:crypto';
import { resolveMx } from 'node:dns/promises';
import { BROWSER_UA, githubHeaders, parseGravatar } from './extract';
import { parseHandle } from './handles';
import { parsePgpKey, type PgpKey } from './pgp';
import type { ProfileFacts } from './facts';

/**
 * What public, keyless sources say about an email address: its mail
 * provider, a Gravatar profile, GitHub accounts and commits under it, and a
 * PGP key whose owner proved the address. Each source fails on its own; the
 * reasons are kept so the panel can say which ones didn't answer.
 */

export type MailKind = 'free' | 'organisation' | 'disposable' | 'relay' | 'none';

export interface MailInfo {
  provider: string | null;
  kind: MailKind;
  mx: string[];
}

export interface GithubTrail {
  users: { login: string; url: string; avatar?: string }[];
  commits: {
    total: number;
    authors: { login?: string; name: string }[];
    repos: string[];
    first?: string;
    last?: string;
  };
}

export interface EmailReport {
  email: string;
  domain: string;
  mail: MailInfo | null;
  gravatar: ProfileFacts | null;
  github: GithubTrail | null;
  pgp: PgpKey | null;
  /** Handles worth a username search, and what suggested each. */
  usernames: { value: string; from: string[] }[];
  /** Sources that didn't answer, and why. */
  errors: Record<string, string>;
}

/* ── mail provider ───────────────────────────────────────────── */

const FREE = /^(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|rocketmail|icloud|me|mac|aol|proton|protonmail|pm|gmx|web|mail|yandex|ya|zoho|tutanota|tuta|tutamail|qq|163|126|naver|hey|fastmail|inbox|rambler|seznam|libero|laposte|orange|free|t-online|wp|o2|interia|uol|bol)\.([a-z]{2,3})(\.[a-z]{2})?$/;

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.net', 'sharklasers.com', 'grr.la', '10minutemail.com',
  '10minutemail.net', 'temp-mail.org', 'tempmail.com', 'tempmail.dev', 'yopmail.com', 'yopmail.fr', 'trashmail.com', 'getnada.com',
  'nada.email', 'maildrop.cc', 'dispostable.com', 'mailnesia.com', 'mintemail.com', 'mohmal.com', 'fakeinbox.com', 'throwawaymail.com',
  'emailondeck.com', 'tempr.email', 'discard.email', 'spamgourmet.com', 'mytemp.email', 'tmpmail.org', 'tmail.ws', 'inboxkitten.com',
  'mailpoof.com', 'moakt.com', 'emailfake.com', 'linshiyouxiang.net', 'tempmailo.com', 'minuteinbox.com', 'mail.tm', 'internxt.com',
]);

// Forwarding aliases: mail reaches someone, but the address hides who.
const RELAY = /(^|\.)(simplelogin\.(com|co|fr)|slmail\.me|aleeas\.com|anonaddy\.(me|com)|addy\.io|duck\.com|privaterelay\.appleid\.com|mozmail\.com|33mail\.com|burnermail\.io)$/;

const PROVIDERS: [RegExp, string | ((domain: string) => string)][] = [
  [/(^|\.)(google|googlemail)\.com$/, d => (/^(gmail|googlemail)\.com$/.test(d) ? 'Gmail' : 'Google Workspace')],
  [/(^|\.)(outlook|hotmail)\.com$/, d => (/^(outlook|hotmail|live|msn)\./.test(d) ? 'Outlook.com' : 'Microsoft 365')],
  [/(^|\.)(protonmail\.ch|proton\.me)$/, 'Proton Mail'],
  [/(^|\.)icloud\.com$/, 'iCloud Mail'],
  [/(^|\.)yahoodns\.net$/, 'Yahoo Mail'],
  [/(^|\.)yandex\.(net|ru)$/, 'Yandex Mail'],
  [/(^|\.)zoho\.(com|eu|in)$/, 'Zoho Mail'],
  [/(^|\.)mail\.ru$/, 'Mail.ru'],
  [/(^|\.)messagingengine\.com$/, 'Fastmail'],
  [/(^|\.)(gmx\.(net|com|de)|web\.de)$/, 'GMX / WEB.DE'],
  [/(^|\.)(tutanota\.de|tuta\.io)$/, 'Tuta'],
  [/(^|\.)mimecast\.com$/, 'Mimecast filtering (the mailbox host is behind it)'],
  [/(^|\.)pphosted\.com$/, 'Proofpoint filtering (the mailbox host is behind it)'],
  [/(^|\.)barracudanetworks\.com$/, 'Barracuda filtering (the mailbox host is behind it)'],
  [/(^|\.)secureserver\.net$/, 'GoDaddy'],
  [/(^|\.)emailsrvr\.com$/, 'Rackspace'],
  [/(^|\.)(ovh\.net|mail\.ovh\.net)$/, 'OVHcloud'],
  [/(^|\.)qq\.com$/, 'QQ Mail'],
  [/(^|\.)(163|126)\.com$/, 'NetEase'],
  [/(^|\.)naver\.com$/, 'Naver'],
  [/(^|\.)improvmx\.com$/, 'ImprovMX forwarding'],
  [/(^|\.)forwardemail\.net$/, 'Forward Email'],
];

export function mailProvider(domain: string, mx: string[]): string | null {
  for (const host of mx) {
    for (const [re, name] of PROVIDERS) if (re.test(host)) return typeof name === 'string' ? name : name(domain);
  }
  if (mx.some(h => h === domain || h.endsWith(`.${domain}`))) return 'Its own mail server';
  return mx[0] ? mx[0].split('.').slice(-2).join('.') : null;
}

export function mailKind(domain: string, mx: string[]): MailKind {
  if (DISPOSABLE.has(domain)) return 'disposable';
  if (RELAY.test(domain)) return 'relay';
  if (!mx.length) return 'none';
  return FREE.test(domain) ? 'free' : 'organisation';
}

async function mailInfo(domain: string): Promise<MailInfo> {
  let mx: string[] = [];
  try {
    const records = await resolveMx(domain);
    // RFC 7505 null MX ("0 .") is a domain declaring it takes no mail.
    mx = records.filter(r => r.exchange && r.exchange !== '.').sort((a, b) => a.priority - b.priority).map(r => r.exchange.toLowerCase().replace(/\.$/, ''));
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== 'ENODATA' && code !== 'ENOTFOUND') throw e;
  }
  return { provider: mailProvider(domain, mx), kind: mailKind(domain, mx), mx };
}

/* ── sources ─────────────────────────────────────────────────── */

// Upstream payloads are unvalidated JSON; each parser reads only the fields it knows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

async function getJson(url: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<{ status: number; data: Json | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json', ...headers } });
  return { status: res.status, data: res.ok ? await res.json().catch(() => null) : null };
}

async function gravatar(email: string, timeoutMs: number): Promise<ProfileFacts | null> {
  const hash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const { status, data } = await getJson(`https://api.gravatar.com/v3/profiles/${hash}`, timeoutMs);
  if (status === 404) return null;
  if (!data) throw new Error(`Gravatar answered ${status}`);
  return parseGravatar(data);
}

async function github(email: string, timeoutMs: number): Promise<GithubTrail | null> {
  const headers = { ...githubHeaders(), Accept: 'application/vnd.github+json' };
  const q = encodeURIComponent(email);
  const [users, commits] = await Promise.all([
    getJson(`https://api.github.com/search/users?q=${q}+in:email&per_page=5`, timeoutMs, headers),
    getJson(`https://api.github.com/search/commits?q=author-email:${q}&sort=author-date&order=desc&per_page=30`, timeoutMs, headers),
  ]);
  // Unauthenticated search allows 10 calls a minute; say so rather than report "nothing".
  if (!users.data && !commits.data) throw new Error(users.status === 403 || users.status === 429 ? 'GitHub search limit reached' : `GitHub answered ${users.status}`);

  const items: Json[] = commits.data?.items ?? [];
  const authors = new Map<string, { login?: string; name: string }>();
  for (const c of items) {
    const login = c.author?.login as string | undefined;
    const name = String(c.commit?.author?.name ?? '').trim();
    const key = login ?? name.toLowerCase();
    if (key && !authors.has(key)) authors.set(key, { login, name: name || login || '' });
  }
  const dates = items.map(c => String(c.commit?.author?.date ?? '')).filter(Boolean).sort();
  const trail: GithubTrail = {
    users: (users.data?.items ?? []).map((u: Json) => ({ login: u.login, url: u.html_url, avatar: u.avatar_url })),
    commits: {
      total: Number(commits.data?.total_count ?? 0),
      authors: [...authors.values()].slice(0, 8),
      repos: [...new Set(items.map(c => String(c.repository?.full_name ?? '')).filter(Boolean))].slice(0, 8),
      first: dates[0]?.slice(0, 10),
      last: dates.at(-1)?.slice(0, 10),
    },
  };
  return trail.users.length || trail.commits.total ? trail : null;
}

async function pgp(email: string, timeoutMs: number): Promise<PgpKey | null> {
  const res = await fetch(`https://keys.openpgp.org/vks/v1/by-email/${encodeURIComponent(email)}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`keys.openpgp.org answered ${res.status}`);
  return parsePgpKey(await res.text());
}

/* ── username leads ──────────────────────────────────────────── */

const HANDLE = /^[a-z0-9._-]{3,40}$/i;

export function usernameLeads(email: string, found: { gravatar?: ProfileFacts | null; github?: GithubTrail | null }): EmailReport['usernames'] {
  const leads = new Map<string, Set<string>>();
  const add = (value: string | undefined, from: string) => {
    if (!value || !HANDLE.test(value)) return;
    const key = value.toLowerCase();
    leads.set(key, (leads.get(key) ?? new Set()).add(from));
  };
  const local = email.split('@')[0].replace(/\+.*$/, '');
  add(local, 'the address');
  if (local.includes('.')) add(local.replace(/\./g, ''), 'the address');
  for (const url of [...(found.gravatar?.links ?? []), ...(found.gravatar?.verified ?? [])]) {
    const h = parseHandle(url);
    if (h && !h.platform.startsWith('fedi:')) add(h.handle, h.platform === 'gravatar' ? 'Gravatar' : `Gravatar → ${h.label}`);
  }
  for (const u of found.github?.users ?? []) add(u.login, 'GitHub account');
  for (const a of found.github?.commits.authors ?? []) add(a.login, 'GitHub commits');
  return [...leads].map(([value, from]) => ({ value, from: [...from] })).slice(0, 12);
}

/* ── entry point ─────────────────────────────────────────────── */

export async function lookupEmail(raw: string, timeoutMs = 10_000): Promise<EmailReport> {
  const email = raw.trim().toLowerCase();
  const domain = email.split('@').pop() ?? '';
  const errors: Record<string, string> = {};
  const settle = async <T>(name: string, p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (e) {
      errors[name] = e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'timed out';
      return null;
    }
  };

  const [mail, grav, gh, key] = await Promise.all([
    settle('mail', mailInfo(domain)),
    settle('gravatar', gravatar(email, timeoutMs)),
    settle('github', github(email, timeoutMs)),
    settle('pgp', pgp(email, timeoutMs)),
  ]);
  return { email, domain, mail, gravatar: grav, github: gh, pgp: key, usernames: usernameLeads(email, { gravatar: grav, github: gh }), errors };
}
