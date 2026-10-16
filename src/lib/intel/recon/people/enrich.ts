import { mapLimit } from '@/lib/intel/recon/username/scan';
import { EXTRACTORS, extractProfile } from './extract';
import { mergeFacts, type ProfileFacts } from './facts';
import { avatarHash } from './avatar';

export interface FoundProfile {
  site: string;
  url: string;
  /** What the sweep read off the page itself. */
  profile?: ProfileFacts;
}

export interface Enriched {
  facts?: ProfileFacts;
  /** dHash of the profile picture. */
  photo?: string;
}

export interface EnrichOptions {
  signal?: AbortSignal;
  /** Wall-clock budget for the whole pass; whatever hasn't answered by then goes without. */
  budgetMs?: number;
  timeoutMs?: number;
  concurrency?: number;
  /** Profile pictures fetched for comparison, at most. */
  maxPhotos?: number;
  /** Called when a platform's API adds to what the page said. */
  onProfile?: (site: string, facts: ProfileFacts) => void;
}

/**
 * Adds API details and a photo hash to each found profile, within a fixed
 * time budget. API reads go first: they are few, and they carry the
 * strongest evidence (verified links), so slow pictures must not starve them.
 */
export async function enrichProfiles(handle: string, found: FoundProfile[], opts: EnrichOptions = {}): Promise<Map<string, Enriched>> {
  const { budgetMs = 20_000, timeoutMs = 6000, concurrency = 8, maxPhotos = 30, onProfile } = opts;
  const deadline = AbortSignal.timeout(budgetMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;
  const out = new Map<string, Enriched>(found.map(f => [f.site, { facts: f.profile }]));

  await mapLimit(found.filter(f => EXTRACTORS[f.site]), concurrency, async f => {
    if (signal.aborted) return;
    const api = await extractProfile(f.site, handle, { timeoutMs, signal });
    if (!api) return;
    const facts = mergeFacts(api, f.profile)!;
    out.set(f.site, { facts });
    onProfile?.(f.site, facts);
  });

  const pictures = [...out]
    .filter(([, e]) => e.facts?.avatar)
    .sort(([, a], [, b]) => Number(b.facts!.via === 'api') - Number(a.facts!.via === 'api'))
    .slice(0, maxPhotos);
  await mapLimit(pictures, concurrency, async ([, e]) => {
    if (signal.aborted) return;
    e.photo = (await avatarHash(e.facts!.avatar!, { timeoutMs, signal })) ?? undefined;
  });
  return out;
}
