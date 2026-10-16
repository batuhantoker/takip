import { safeFetch } from '@/lib/core/net/ssrf-guard';

/** The protective response headers we grade a site on, worst-missing first. */
export const PROTECTIVE_HEADERS: [string, string][] = [
  ['strict-transport-security', 'HSTS'],
  ['content-security-policy', 'CSP'],
  ['x-frame-options', 'X-Frame-Options'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['referrer-policy', 'Referrer-Policy'],
  ['permissions-policy', 'Permissions-Policy'],
];

export interface SecurityGrade {
  score: number;
  max: number;
  grade: 'A' | 'B' | 'C' | 'F';
  present: string[];
  missing: string[];
}

export interface HeadersReport {
  url: string;
  final_url: string;
  status: number;
  redirected: boolean;
  headers: Record<string, string>;
  security: SecurityGrade;
}

export interface Technology { name: string; category: string; evidence: string }
export interface TechReport {
  url: string;
  final_url: string;
  status: number;
  server: string | null;
  powered_by: string | null;
  technologies: Technology[];
}

function withScheme(input: string): string {
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

function collectHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => { out[k] = v; });
  return out;
}

function gradeSecurity(headers: Record<string, string>): SecurityGrade {
  const present: string[] = [];
  const missing: string[] = [];
  for (const [header, name] of PROTECTIVE_HEADERS) {
    (headers[header] ? present : missing).push(name);
  }
  const score = present.length;
  const max = PROTECTIVE_HEADERS.length;
  const grade = score >= 5 ? 'A' : score >= 3 ? 'B' : score >= 1 ? 'C' : 'F';
  return { score, max, grade, present, missing };
}

export async function inspectHeaders(target: string, timeoutMs = 10_000): Promise<HeadersReport> {
  const url = withScheme(target);
  const res = await safeFetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
    maxRedirects: 4,
    headers: { 'User-Agent': 'Mozilla/5.0 TAKIP-Recon', Accept: 'text/html,*/*' },
  });
  // Drain the body so the socket is released; we only need the headers.
  await res.text().catch(() => '');
  const headers = collectHeaders(res);
  return {
    url,
    final_url: res.url || url,
    status: res.status,
    redirected: res.url !== url && res.url !== `${url}/`,
    headers,
    security: gradeSecurity(headers),
  };
}

/** header-name → [tech, category]. Matched case-insensitively on the value. */
const HEADER_SIGNS: [string, RegExp, string, string][] = [
  ['server', /nginx/i, 'nginx', 'Web server'],
  ['server', /apache/i, 'Apache', 'Web server'],
  ['server', /microsoft-iis/i, 'IIS', 'Web server'],
  ['server', /litespeed/i, 'LiteSpeed', 'Web server'],
  ['server', /caddy/i, 'Caddy', 'Web server'],
  ['server', /cloudflare/i, 'Cloudflare', 'CDN'],
  ['x-powered-by', /php/i, 'PHP', 'Language'],
  ['x-powered-by', /express/i, 'Express', 'Framework'],
  ['x-powered-by', /asp\.net/i, 'ASP.NET', 'Framework'],
  ['x-powered-by', /next\.js/i, 'Next.js', 'Framework'],
  ['x-aspnet-version', /./, 'ASP.NET', 'Framework'],
  ['x-generator', /drupal/i, 'Drupal', 'CMS'],
  ['x-drupal-cache', /./, 'Drupal', 'CMS'],
  ['x-shopify-stage', /./, 'Shopify', 'Ecommerce'],
  ['x-vercel-id', /./, 'Vercel', 'Hosting'],
  ['x-served-by', /wordpress|wpengine/i, 'WordPress', 'CMS'],
  ['cf-ray', /./, 'Cloudflare', 'CDN'],
  ['x-amz-cf-id', /./, 'CloudFront', 'CDN'],
  ['fastly-debug-digest', /./, 'Fastly', 'CDN'],
];

/** cookie-name → [tech, category]. */
const COOKIE_SIGNS: [RegExp, string, string][] = [
  [/PHPSESSID/, 'PHP', 'Language'],
  [/JSESSIONID/, 'Java', 'Language'],
  [/ASP\.NET_SessionId|\.AspNetCore/i, 'ASP.NET', 'Framework'],
  [/laravel_session/i, 'Laravel', 'Framework'],
  [/wordpress_|wp-settings/i, 'WordPress', 'CMS'],
  [/csrftoken|django/i, 'Django', 'Framework'],
  [/_shopify/i, 'Shopify', 'Ecommerce'],
];

/** HTML markers. Kept narrow: only signatures a site genuinely emits. */
const HTML_SIGNS: [RegExp, string, string][] = [
  [/<meta[^>]+name=["']generator["'][^>]+content=["']wordpress/i, 'WordPress', 'CMS'],
  [/<meta[^>]+name=["']generator["'][^>]+content=["']drupal/i, 'Drupal', 'CMS'],
  [/<meta[^>]+name=["']generator["'][^>]+content=["']joomla/i, 'Joomla', 'CMS'],
  [/<meta[^>]+name=["']generator["'][^>]+content=["']hugo/i, 'Hugo', 'Static site'],
  [/<meta[^>]+name=["']generator["'][^>]+content=["']ghost/i, 'Ghost', 'CMS'],
  [/wp-content\/|wp-includes\//i, 'WordPress', 'CMS'],
  [/\/_next\/static\//i, 'Next.js', 'Framework'],
  [/\/_nuxt\//i, 'Nuxt', 'Framework'],
  [/data-reactroot|react(?:-dom)?\.production/i, 'React', 'Framework'],
  [/ng-version=/i, 'Angular', 'Framework'],
  [/cdn\.shopify\.com/i, 'Shopify', 'Ecommerce'],
  [/gatsby-/i, 'Gatsby', 'Framework'],
  [/svelte-/i, 'Svelte', 'Framework'],
  [/\bwix\.com\b|static\.wixstatic\.com/i, 'Wix', 'Site builder'],
  [/squarespace\.com/i, 'Squarespace', 'Site builder'],
];

export async function fingerprintTech(target: string, timeoutMs = 10_000): Promise<TechReport> {
  const url = withScheme(target);
  const res = await safeFetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
    maxRedirects: 4,
    headers: { 'User-Agent': 'Mozilla/5.0 TAKIP-Recon', Accept: 'text/html,*/*' },
  });
  const html = (await res.text().catch(() => '')).slice(0, 200_000);
  const headers = collectHeaders(res);

  const found = new Map<string, Technology>();
  const add = (name: string, category: string, evidence: string) => {
    if (!found.has(name)) found.set(name, { name, category, evidence });
  };

  for (const [header, re, name, category] of HEADER_SIGNS) {
    const v = headers[header];
    if (v && re.test(v)) add(name, category, header === 'server' || header === 'x-powered-by' ? `${header}: ${v}` : `${header} header`);
  }
  const cookie = headers['set-cookie'] ?? '';
  for (const [re, name, category] of COOKIE_SIGNS) {
    if (re.test(cookie)) add(name, category, 'session cookie');
  }
  for (const [re, name, category] of HTML_SIGNS) {
    if (re.test(html)) add(name, category, 'page markup');
  }

  return {
    url,
    final_url: res.url || url,
    status: res.status,
    server: headers.server ?? null,
    powered_by: headers['x-powered-by'] ?? null,
    technologies: [...found.values()],
  };
}
