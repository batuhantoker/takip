import { NextResponse } from 'next/server';

/**
 * OSIRIS — Financial Markets API
 * Defense stocks and oil prices via free Yahoo Finance endpoint
 */

const TICKERS = ['RTX', 'LMT', 'NOC', 'GD', 'BA', 'PLTR'];
const OIL_TICKERS = ['CL=F', 'BZ=F'];

async function fetchQuote(symbol: string): Promise<any | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close || [];

    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
    const prevClose = meta.chartPreviousClose || closes[0];

    if (!currentPrice || !prevClose) return null;

    const changePercent = ((currentPrice - prevClose) / prevClose) * 100;

    return {
      price: Math.round(currentPrice * 100) / 100,
      change_percent: Math.round(changePercent * 100) / 100,
      up: changePercent >= 0,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // Fetch all tickers in parallel
    const [stockResults, oilResults] = await Promise.all([
      Promise.all(TICKERS.map(async (t) => ({ symbol: t, data: await fetchQuote(t) }))),
      Promise.all(OIL_TICKERS.map(async (t) => ({ symbol: t, data: await fetchQuote(t) }))),
    ]);

    const stocks: Record<string, any> = {};
    for (const { symbol, data } of stockResults) {
      if (data) stocks[symbol] = data;
    }

    const oil: Record<string, any> = {};
    const oilNames: Record<string, string> = { 'CL=F': 'WTI Crude', 'BZ=F': 'Brent Crude' };
    for (const { symbol, data } of oilResults) {
      if (data) oil[oilNames[symbol] || symbol] = data;
    }

    return NextResponse.json({
      stocks,
      oil,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Markets fetch error:', error);
    return NextResponse.json({ stocks: {}, oil: {}, error: 'Failed to fetch market data' }, { status: 500 });
  }
}
