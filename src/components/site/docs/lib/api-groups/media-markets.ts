import type { ApiGroup } from '../../api-catalog';

export const MEDIA_MARKETS: ApiGroup = {
  id: 'media-markets',
  title: 'Media and markets',
  blurb: 'News aggregation, live broadcast streams, and financial instruments.',
  endpoints: [
    {
      path: '/api/news',
      method: 'GET',
      summary: 'Telegram OSINT channels and wire services in one feed: each story with the declared lean of every source carrying it, media, cross-posts and a per-source health report. risk_score is a keyword count, not a model output, and coords are preset country anchors.',
      returns: ['news', 'total', 'sources', 'timestamp'],
      notes: 'A story several sources carry folds into one report that names them all. A source that fails a refresh keeps serving its last good items.',
    },
    {
      path: '/api/live-news',
      method: 'GET',
      summary: '24/7 broadcast streams grouped by category.',
      returns: ['feeds', 'categories', 'total', 'timestamp'],
    },
    {
      path: '/api/markets',
      method: 'GET',
      summary: 'Indices, rates, FX, defence equities, energy, commodities and crypto from Yahoo, each with a month of daily closes and its session state.',
      returns: ['indices', 'stocks', 'oil', 'commodities', 'crypto', 'fx', 'scm_alerts', 'count', 'timestamp'],
      notes: 'Each group maps a symbol to its quote. FX falls back to ECB fixings. Not cached, so `scm_alerts` stay current.',
    },
    {
      path: '/api/crypto',
      method: 'GET',
      summary: 'USD spot prices for BTC, ETH and SOL from CoinGecko, for the status ticker.',
      returns: ['[].symbol', '[].price'],
      notes: 'A bare array, empty when CoinGecko fails.',
    },
    {
      path: '/api/scm-suppliers',
      method: 'GET',
      summary: 'Supply-chain suppliers with criticality flags.',
      returns: ['suppliers', 'total', 'critical_count', 'timestamp'],
    },
  ],
};
