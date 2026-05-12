import { NextResponse } from 'next/server';

/**
 * OSIRIS — Financial Markets & Commodities API
 * Defense stocks, oil, gold, silver, natural gas, wheat, crypto — via Yahoo Finance
 * FREE — No API key required
 */

const DEFENSE_STOCKS = ['RTX', 'LMT', 'NOC', 'GD', 'BA', 'PLTR'];
const OIL_TICKERS = ['CL=F', 'BZ=F'];
const COMMODITY_TICKERS = ['GC=F', 'SI=F', 'HG=F', 'NG=F', 'ZW=F', 'ZC=F'];
const CRYPTO_TICKERS = ['BTC-USD', 'ETH-USD'];
const INDEX_TICKERS = ['ES=F', 'NQ=F']; // S&P 500 Futures, Nasdaq Futures

async function fetchQuote(symbol: string): Promise<any | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
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
  } catch { return null; }
}

const COMMODITY_NAMES: Record<string, string> = {
  'GC=F': 'Gold', 'SI=F': 'Silver', 'HG=F': 'Copper',
  'NG=F': 'Natural Gas', 'ZW=F': 'Wheat', 'ZC=F': 'Corn',
};
const OIL_NAMES: Record<string, string> = { 'CL=F': 'WTI Crude', 'BZ=F': 'Brent Crude' };
const CRYPTO_NAMES: Record<string, string> = { 'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ethereum' };
const INDEX_NAMES: Record<string, string> = { 'ES=F': 'S&P 500', 'NQ=F': 'Nasdaq 100' };

export async function GET() {
  try {
    const [stockResults, oilResults, commodityResults, cryptoResults, indexResults] = await Promise.all([
      Promise.all(DEFENSE_STOCKS.map(async t => ({ symbol: t, data: await fetchQuote(t) }))),
      Promise.all(OIL_TICKERS.map(async t => ({ symbol: t, data: await fetchQuote(t) }))),
      Promise.all(COMMODITY_TICKERS.map(async t => ({ symbol: t, data: await fetchQuote(t) }))),
      Promise.all(CRYPTO_TICKERS.map(async t => ({ symbol: t, data: await fetchQuote(t) }))),
      Promise.all(INDEX_TICKERS.map(async t => ({ symbol: t, data: await fetchQuote(t) }))),
    ]);

    const stocks: Record<string, any> = {};
    for (const { symbol, data } of stockResults) { if (data) stocks[symbol] = data; }

    const oil: Record<string, any> = {};
    for (const { symbol, data } of oilResults) { if (data) oil[OIL_NAMES[symbol] || symbol] = data; }

    const commodities: Record<string, any> = {};
    for (const { symbol, data } of commodityResults) { if (data) commodities[COMMODITY_NAMES[symbol] || symbol] = data; }

    const crypto: Record<string, any> = {};
    for (const { symbol, data } of cryptoResults) { if (data) crypto[CRYPTO_NAMES[symbol] || symbol] = data; }

    const indices: Record<string, any> = {};
    for (const { symbol, data } of indexResults) { if (data) indices[INDEX_NAMES[symbol] || symbol] = data; }

    return NextResponse.json({
      stocks, oil, commodities, crypto, indices,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('Markets fetch error:', error);
    return NextResponse.json({ stocks: {}, oil: {}, commodities: {}, crypto: {}, indices: {}, error: 'Failed' }, { status: 500 });
  }
}
