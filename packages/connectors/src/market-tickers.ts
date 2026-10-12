/** Display name and section for every instrument the markets feed tracks; the price-history route serves these and nothing else. */
export const TICKERS: Array<{ symbol: string; name: string; group: string }> = [
  { symbol: 'ES=F', name: 'S&P 500', group: 'indices' },
  { symbol: 'NQ=F', name: 'Nasdaq 100', group: 'indices' },
  { symbol: '^VIX', name: 'VIX', group: 'indices' },
  { symbol: 'DX-Y.NYB', name: 'Dollar Index', group: 'indices' },
  { symbol: '^TNX', name: 'US 10Y', group: 'indices' },
  // The rest of the world's trading day, so the board isn't US-only.
  { symbol: '^GDAXI', name: 'DAX', group: 'indices' },
  { symbol: '^FTSE', name: 'FTSE 100', group: 'indices' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', group: 'indices' },
  { symbol: '^N225', name: 'Nikkei 225', group: 'indices' },
  { symbol: '^HSI', name: 'Hang Seng', group: 'indices' },

  { symbol: 'RTX', name: 'RTX', group: 'stocks' },
  { symbol: 'LMT', name: 'LMT', group: 'stocks' },
  { symbol: 'NOC', name: 'NOC', group: 'stocks' },
  { symbol: 'GD', name: 'GD', group: 'stocks' },
  { symbol: 'BA', name: 'BA', group: 'stocks' },
  { symbol: 'LHX', name: 'LHX', group: 'stocks' },
  { symbol: 'PLTR', name: 'PLTR', group: 'stocks' },

  { symbol: 'CL=F', name: 'WTI Crude', group: 'oil' },
  { symbol: 'BZ=F', name: 'Brent Crude', group: 'oil' },
  { symbol: 'NG=F', name: 'Natural Gas', group: 'oil' },

  { symbol: 'GC=F', name: 'Gold', group: 'commodities' },
  { symbol: 'SI=F', name: 'Silver', group: 'commodities' },
  { symbol: 'HG=F', name: 'Copper', group: 'commodities' },
  { symbol: 'ZW=F', name: 'Wheat', group: 'commodities' },
  { symbol: 'ZC=F', name: 'Corn', group: 'commodities' },

  { symbol: 'BTC-USD', name: 'Bitcoin', group: 'crypto' },
  { symbol: 'ETH-USD', name: 'Ethereum', group: 'crypto' },
  { symbol: 'SOL-USD', name: 'Solana', group: 'crypto' },
  { symbol: 'XRP-USD', name: 'XRP', group: 'crypto' },

  { symbol: 'EURUSD=X', name: 'EUR/USD', group: 'fx' },
  { symbol: 'USDJPY=X', name: 'USD/JPY', group: 'fx' },
  { symbol: 'GBPUSD=X', name: 'GBP/USD', group: 'fx' },
  { symbol: 'USDCNY=X', name: 'USD/CNY', group: 'fx' },
];
