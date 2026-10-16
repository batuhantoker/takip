import { pageFacts } from '../people/page';
import type { ProfileFacts } from '../people/facts';
import type { SiteDef } from './sites';

export type Status = 'found' | 'not_found' | 'error' | 'skipped' | 'inconclusive' | 'blocked' | 'unreliable';

/**
 * Codes that mean "we were refused", not "no such account". Measured against
 * Sherlock's own known-good handles, treating these as absence produced 8 of
 * 12 false negatives — the single largest source of wrong answers.
 */
const BLOCKED_CODES = new Set([401, 403, 407, 429, 451, 503]);

/** Interstitials that return 200 while showing no profile data. */
const CHALLENGE_MARKERS = [
  'just a moment',
  'attention required',
  'cf-browser-verification',
  'enable javascript and cookies',
  'checking your browser',
  'access denied',
  'unusual traffic',
  'are you a robot',
  'px-captcha',
  'captcha-delivery',
  'client challenge',
  'security verification',
  'making sure you\'re not a bot',
  'verify you are human',
  'ddos-guard',
  'privacy gate',
];

function looksLikeChallenge(body: string): boolean {
  const head = body.slice(0, 4000).toLowerCase();
  return CHALLENGE_MARKERS.some(m => head.includes(m));
}

export interface SiteResult {
  site: string;
  url: string;
  status: Status;
  http_status?: number;
  /** Why a check errored or was skipped — never left implicit. */
  reason?: string;
  ms: number;
  /** What the found page says about its owner, read from its metadata. */
  profile?: ProfileFacts;
  /** A hit whose check against a made-up handle never ran. */
  unverified?: boolean;
}

export function fill(template: string, username: string): string {
  return template.replace('{}', encodeURIComponent(username));
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

const MAX_PAGE = 512 * 1024;

async function readText(res: Response, max = MAX_PAGE): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length >= max) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return text;
}

/**
 * A 2xx answer, checked once more before it counts. Status-code sites never
 * looked at the body, so a bot challenge served with 200 used to read as a
 * profile; now the page is read (HTML only, capped) and a challenge is a
 * refusal. `body` is passed when the caller already read it.
 */
async function hit(
  res: Response, body: string | null, site: string, url: string, username: string, ms: number, readPage: boolean,
): Promise<SiteResult> {
  const html = /html/i.test(res.headers.get('content-type') || '');
  const text = body ?? (html ? await readText(res) : '');
  if (text && looksLikeChallenge(text)) {
    return { site, url, status: 'blocked', http_status: res.status, reason: 'bot challenge served instead of a profile', ms };
  }
  const profile = readPage && html && text ? pageFacts(text, site, username) : undefined;
  return { site, url, status: 'found', http_status: res.status, ms, profile };
}

export async function checkSite(name: string, def: SiteDef, username: string, timeoutMs: number, readPage = false): Promise<SiteResult> {
  const started = Date.now();
  const profileUrl = fill(def.url, username);

  // Sites declare which usernames are even valid for them; a mismatch is a
  // skip, not a miss — reporting it as "not found" would be misleading.
  if (def.regexCheck) {
    try {
      if (!new RegExp(def.regexCheck).test(username)) {
        return { site: name, url: profileUrl, status: 'skipped', reason: 'username invalid for this site', ms: 0 };
      }
    } catch {
      /* an unusable pattern upstream shouldn't drop the site */
    }
  }

  const requestUrl = def.urlProbe ? fill(def.urlProbe, username) : profileUrl;
  const method = (def.request_method || 'GET').toUpperCase();

  try {
    const init: RequestInit = {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: {
        // A browser User-Agent only. Sending an explicit Accept header made
        // things worse, not better — Discogs answers 403 with it and 200
        // without, and no site was measured to need it.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        ...(def.headers || {}),
      },
    };
    if (method === 'POST' && def.request_payload !== undefined) {
      init.body = JSON.stringify(def.request_payload).replace('{}', username);
      init.headers = { ...(init.headers as Record<string, string>), 'Content-Type': 'application/json' };
    }

    const res = await fetch(requestUrl, init);
    const ms = Date.now() - started;

    /* A refusal tells us nothing about the account. Checked before any
       per-strategy logic, because a challenge body contains neither the
       site's "missing profile" marker (which would read as a hit) nor real
       profile data. A site's own errorCode still wins — some legitimately
       answer 403 for an absent user. */
    const declaredErrorCodes = asArray(def.errorCode);
    if (BLOCKED_CODES.has(res.status) && !declaredErrorCodes.includes(res.status)) {
      return {
        site: name,
        url: profileUrl,
        status: 'blocked',
        http_status: res.status,
        reason: res.status === 429 ? 'rate limited by the site' : `refused with HTTP ${res.status}`,
        ms,
      };
    }

    if (def.errorType === 'status_code') {
      if (declaredErrorCodes.includes(res.status)) {
        return { site: name, url: profileUrl, status: 'not_found', http_status: res.status, ms };
      }
      const found = res.status >= 200 && res.status < 300;
      if (found) return hit(res, null, name, profileUrl, username, ms, readPage);

      /* Some urlProbe endpoints upstream are simply broken — PyPi's points at
         an admin-only include that 404s for everyone, so a real account reads
         as absent. When a probe says "missing", give the canonical profile URL
         one chance to disagree. Calibration re-tests any positive against a
         control, so a soft-404 here cannot sneak through as a hit. */
      if (!found && def.urlProbe && requestUrl !== profileUrl) {
        try {
          const confirm = await fetch(profileUrl, { ...init, signal: AbortSignal.timeout(timeoutMs) });
          if (confirm.status >= 200 && confirm.status < 300) {
            return hit(confirm, null, name, profileUrl, username, Date.now() - started, readPage);
          }
        } catch {
          /* fall through to the probe's verdict */
        }
      }

      return { site: name, url: profileUrl, status: 'not_found', http_status: res.status, ms };
    }

    if (def.errorType === 'message') {
      const body = await res.text();
      if (looksLikeChallenge(body)) {
        return { site: name, url: profileUrl, status: 'blocked', http_status: res.status, reason: 'bot challenge served instead of a profile', ms };
      }
      const markers = asArray(def.errorMsg);
      if (markers.some(m => body.includes(m))) return { site: name, url: profileUrl, status: 'not_found', http_status: res.status, ms };
      return hit(res, body, name, profileUrl, username, ms, readPage);
    }

    // response_url: a missing profile lands on a known URL.
    const landed = res.url || requestUrl;
    const isError = !!def.errorUrl && landed.startsWith(fill(def.errorUrl, username));
    const found = !isError && res.status >= 200 && res.status < 300;
    if (!found) return { site: name, url: profileUrl, status: 'not_found', http_status: res.status, ms };
    return hit(res, null, name, profileUrl, username, ms, readPage);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'request failed';
    return {
      site: name,
      url: profileUrl,
      status: 'error',
      reason: /timeout|aborted|TimeoutError/i.test(msg) ? `timed out after ${timeoutMs}ms` : msg,
      ms: Date.now() - started,
    };
  }
}
