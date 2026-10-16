import { NextResponse } from 'next/server';
import { reconGate } from '@/lib/intel/recon/gate';

export async function GET(req: Request) {
  const denied = await reconGate(req, 'breach');
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });

  try {
    // We will call the breach-analytics endpoint to get deep details on what exactly was leaked.
    const res = await fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`, { signal: AbortSignal.timeout(15000),
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TAKIP/0.1'
      }
    });
    
    if (res.status === 404) {
      return NextResponse.json({ email, breached: false, breaches: [], data_exposed: [] });
    }

    if (!res.ok) throw new Error(`XposedOrNot API HTTP ${res.status}`);

    const data = await res.json();
    
    // Parse the analytics data
    let breachList = [];
    const dataExposed = new Set<string>();

    if (data.BreachesSummary && data.BreachesSummary.site) {
       breachList = data.BreachesSummary.site.split(';').filter(Boolean);
    }
    
    if (data.ExposedData && Array.isArray(data.ExposedData)) {
       data.ExposedData.forEach((item: any) => {
          if (item.data_classes && Array.isArray(item.data_classes)) {
             item.data_classes.forEach((dc: string) => dataExposed.add(dc));
          }
       });
    }

    // Per-breach year, size and what leaked, newest first, for the people search.
    type Detail = { breach?: string; xposed_date?: string | number; xposed_records?: number; domain?: string; industry?: string; password_risk?: string; xposed_data?: string };
    const details = (Array.isArray(data.ExposedBreaches?.breaches_details) ? data.ExposedBreaches.breaches_details as Detail[] : [])
      .map(b => ({
        name: String(b.breach ?? ''),
        year: b.xposed_date ? String(b.xposed_date) : null,
        records: typeof b.xposed_records === 'number' ? b.xposed_records : null,
        domain: b.domain || null,
        industry: b.industry || null,
        password_risk: b.password_risk || null,
        data: typeof b.xposed_data === 'string' ? b.xposed_data.split(';').filter(Boolean) : [],
      }))
      .filter(b => b.name)
      .sort((a, b) => (b.year ?? '').localeCompare(a.year ?? ''));
    const risk = data.BreachMetrics?.risk?.[0];

    return NextResponse.json({
      email,
      breached: breachList.length > 0,
      breaches: breachList,
      data_exposed: Array.from(dataExposed).sort(),
      details,
      risk: risk ? { label: risk.risk_label ?? null, score: risk.risk_score ?? null } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Leak lookup failed', detail: error.message }, { status: 500 });
  }
}
