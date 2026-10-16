import { NextResponse } from 'next/server';
import { advisoriesFor, allAdvisories } from './lookup';

/**
 * TAKIP — official travel advice per country, on FCDO's 0–4 scale.
 * No params: every country from the US State Department and Smartraveller (both whole-feed RSS).
 * `?iso2=XX`: that country from all three issuers, including the UK FCDO (one gov.uk page per country).
 * A failed issuer is reported in `sources` and never shows up as a "no warning" row.
 */

const HEADERS = { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' };

export async function GET(request: Request) {
  const iso2Param = new URL(request.url).searchParams.get('iso2');
  if (iso2Param != null && !/^[A-Za-z]{2}$/.test(iso2Param)) {
    return NextResponse.json({ error: 'iso2 must be a two-letter ISO 3166-1 code' }, { status: 400 });
  }
  const timestamp = new Date().toISOString();
  if (iso2Param == null) return NextResponse.json({ ...(await allAdvisories()), timestamp }, { headers: HEADERS });

  const iso2 = iso2Param.toUpperCase();
  return NextResponse.json({ iso2, ...(await advisoriesFor(iso2)), timestamp }, { headers: HEADERS });
}
