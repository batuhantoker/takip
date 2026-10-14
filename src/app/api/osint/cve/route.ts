import { NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/ssrf-guard';
import { reconGate } from '@/lib/recon/gate';
import { severityOf } from '@/lib/recon/vuln';

// CVE details. Shodan's CVEDB answers CVSS, EPSS, CISA KEV and a summary in a
// single keyless call; MITRE is the fallback. No key.
export async function GET(req: Request) {
  const denied = await reconGate(req, 'reference');
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const cve = searchParams.get('cve');
  if (!cve) return NextResponse.json({ error: 'Missing cve parameter' }, { status: 400 });

  if (isRateLimited(getClientIp(req), 30, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  if (!/^CVE-\d{4}-\d{4,}$/i.test(cve)) {
    return NextResponse.json({ error: 'Invalid CVE format. Expected: CVE-YYYY-NNNNN' }, { status: 400 });
  }

  const id = cve.toUpperCase();

  try {
    const res = await fetch(`https://cvedb.shodan.io/cve/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const d = await res.json();
      const cvss = d.cvss != null ? Number(d.cvss) : null;
      const epss = d.epss != null ? Number(d.epss) : null;
      return NextResponse.json({
        id: d.cve_id || id,
        description: d.summary || 'No description available.',
        cvss: Number.isFinite(cvss) ? cvss : null,
        severity: severityOf(Number.isFinite(cvss) ? cvss : null),
        epss: Number.isFinite(epss) ? epss : null,
        kev: d.kev === true || d.kev === 'true',
        references: Array.isArray(d.references) ? d.references.slice(0, 5) : [],
        published: d.published_time || null,
        source: 'shodan-cvedb',
      });
    }
  } catch { /* fall through to MITRE */ }

  try {
    const res = await fetch(`https://cveawg.mitre.org/api/cve/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const cna = data.containers?.cna;
      const description = cna?.descriptions?.find((x: { lang: string }) => x.lang === 'en')?.value
        || cna?.descriptions?.[0]?.value || 'No description available.';
      let cvss: number | null = null;
      let cvssVector: string | null = null;
      for (const m of cna?.metrics ?? []) {
        const v = m.cvssV3_1 || m.cvssV3_0 || m.cvssV31 || m.cvssV4_0;
        if (v) { cvss = v.baseScore ?? null; cvssVector = v.vectorString ?? null; break; }
      }
      return NextResponse.json({
        id, description, cvss, cvss_vector: cvssVector, severity: severityOf(cvss),
        references: (cna?.references ?? []).slice(0, 5).map((r: { url: string }) => r.url),
        published: data.cveMetadata?.datePublished || null, source: 'mitre',
      });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ id, description: 'CVE details could not be retrieved at this time.', cvss: null, references: [], source: 'unavailable' });
}
