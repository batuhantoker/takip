import { entitlementRequired, requireAccount } from '@/lib/platform/account/access-server';
import { createAccountLimiter } from '@/lib/platform/account/limiter';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Per account, lowest for looking people up. Routes that call a third party keep their per-address limit too. */
export const RECON_LIMITS = {
  breach: { limit: 20, windowMs: HOUR },
  people: { limit: 30, windowMs: HOUR },
  scan: { limit: 30, windowMs: HOUR },
  network: { limit: 15, windowMs: MINUTE },
  reference: { limit: 30, windowMs: MINUTE },
};
export type ReconFamily = keyof typeof RECON_LIMITS;

const limiter = createAccountLimiter(RECON_LIMITS);

/**
 * For every OSINT and recon route: a response refusing the caller, or null to carry on. A `probe`
 * reaches the target from this server's own address, so it also needs the plan's `recon.scan`.
 */
export async function reconGate(request: Request, family: ReconFamily, { probe = false } = {}): Promise<Response | null> {
  const access = await requireAccount(request);
  if (access instanceof Response) return access;
  if (probe && !access.entitlements['recon.scan']) return entitlementRequired('recon.scan');
  const wait = limiter.take(family, access.subject.id);
  if (!wait) return null;
  return Response.json({ error: 'rate_limited', retry_after: wait }, { status: 429, headers: { 'Retry-After': String(wait) } });
}
