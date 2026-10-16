import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/core/net/ssrf-guard';
import { reconGate } from '@/lib/intel/recon/gate';
import { lookupEmail } from '@/lib/intel/recon/people/email';

/**
 * TAKIP — what public sources tie to an email address: its mail provider,
 * a Gravatar profile, GitHub accounts and commits under it, a PGP key whose
 * owner proved the address, and usernames worth searching next. Keyless;
 * GITHUB_TOKEN, when set, lifts GitHub's search limit.
 *
 *   ?email=  the address (required)
 */

export const maxDuration = 30;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(req: Request) {
  const denied = await reconGate(req, 'people');
  if (denied) return denied;
  const email = (new URL(req.url).searchParams.get('email') || '').trim();

  if (!email) return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 });

  if (isRateLimited(`email:${getClientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again in a minute' }, { status: 429 });
  }

  const report = await lookupEmail(email);
  return NextResponse.json({ ...report, timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
