import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });

  try {
    const res = await fetch(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (res.status === 404) {
      return NextResponse.json({ email, breached: false, breaches: [] });
    }

    if (!res.ok) throw new Error(`XposedOrNot API HTTP ${res.status}`);

    const data = await res.json();
    return NextResponse.json({
      email,
      breached: true,
      breaches: data.breaches?.[0] || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Leak lookup failed', detail: error.message }, { status: 502 });
  }
}
