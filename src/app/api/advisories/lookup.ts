import { fetchFcdoAdvisory, type FcdoAdvisory } from './fcdo';
import { fetchSmartraveller } from './smartraveller';
import { memoByKey, memoSource, type Memoized } from './source-memo';
import type { Advisory, AdvisoryIssuer, AdvisorySource, ParsedAdvisories } from './types';
import { fetchUsAdvisories } from './us-state';

/** Memoized issuer reads shared by `/api/advisories` and the region dossier. */

const HOUR = 60 * 60_000;

const FEEDS: { issuer: AdvisoryIssuer; load: () => Promise<Memoized<ParsedAdvisories>> }[] = [
  { issuer: 'US State Department', load: memoSource(fetchUsAdvisories, HOUR) },
  { issuer: 'Australia Smartraveller', load: memoSource(fetchSmartraveller, HOUR) },
];

const loadFcdo = memoByKey<FcdoAdvisory | null>(fetchFcdoAdvisory, HOUR);

function sourceOf(issuer: AdvisoryIssuer, m: Memoized<unknown>): AdvisorySource {
  if (!m.loaded) return { issuer, ok: false, error: m.error ?? 'not loaded' };
  return m.error ? { issuer, ok: true, stale: true, error: m.error } : { issuer, ok: true };
}

export const byCountry = (a: Advisory, b: Advisory) => a.iso2.localeCompare(b.iso2) || a.issuer.localeCompare(b.issuer);

/** Resolves to null after `ms`; the load itself keeps going and fills the memo for the next caller. */
function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  if (!Number.isFinite(ms)) return p;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms); })]).finally(() => clearTimeout(timer));
}

const NOT_YET: Memoized<ParsedAdvisories> = { loaded: false, value: undefined, error: 'no answer within the time budget', fetchedAt: null };

/** Every country from the whole-feed issuers (US, Australia). */
export async function allAdvisories(budgetMs = Infinity): Promise<{ advisories: Advisory[]; unmatched: string[]; sources: AdvisorySource[] }> {
  const feeds = await Promise.all(FEEDS.map(async f => ({ issuer: f.issuer, memo: (await within(f.load(), budgetMs)) ?? NOT_YET })));
  return {
    advisories: feeds.flatMap(f => f.memo.value?.advisories ?? []).sort(byCountry),
    unmatched: feeds.flatMap(f => f.memo.value?.unmatched ?? []),
    sources: feeds.map(f => sourceOf(f.issuer, f.memo)),
  };
}

/**
 * One country from all three issuers, the UK FCDO included. `budgetMs` caps the wait on the whole
 * feeds: Smartraveller can hang for its full timeout, which a dossier click should not inherit.
 */
export async function advisoriesFor(iso2: string, budgetMs = Infinity): Promise<{ advisories: Advisory[]; sources: AdvisorySource[] }> {
  const [all, fcdo] = await Promise.all([allAdvisories(budgetMs), loadFcdo(iso2)]);
  const advisories = all.advisories.filter(a => a.iso2 === iso2);
  if (fcdo.value) advisories.push(fcdo.value);
  return { advisories: advisories.sort(byCountry), sources: [...all.sources, sourceOf('UK FCDO', fcdo)] };
}
