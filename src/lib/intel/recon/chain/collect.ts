import { type Chain, CHAIN_META, type TxSummary } from './detect';

async function getJson(url: string, timeoutMs = 15000, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

async function rpc(url: string, method: string, params: any[], timeoutMs = 15000): Promise<any> {
  const body = await getJson(url, timeoutMs, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (body.error) throw new Error(`${method}: ${body.error.message || 'RPC error'}`);
  return body.result;
}

/**
 * Spot USD price. CoinGecko's keyless tier rate-limits hard enough that a
 * per-lookup call starts returning nothing after a handful of scans, so
 * prices are cached process-wide and all three chains are fetched at once.
 * A stale price beats no price; failure is non-fatal either way.
 */
const PRICE_TTL = 120_000;
let priceCache: { at: number; usd: Partial<Record<Chain, number>> } | null = null;

export async function fetchPrice(chain: Chain): Promise<number | null> {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL) {
    return priceCache.usd[chain] ?? null;
  }
  try {
    const ids = (Object.keys(CHAIN_META) as Chain[]).map(c => CHAIN_META[c].coingecko).join(',');
    const d = await getJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      10000
    );
    const usd: Partial<Record<Chain, number>> = {};
    for (const c of Object.keys(CHAIN_META) as Chain[]) {
      const v = d?.[CHAIN_META[c].coingecko]?.usd;
      if (typeof v === 'number') usd[c] = v;
    }
    if (Object.keys(usd).length) priceCache = { at: Date.now(), usd };
    return usd[chain] ?? priceCache?.usd[chain] ?? null;
  } catch (e) {
    console.warn('[TAKIP] price lookup failed:', e instanceof Error ? e.message : e);
    // Serve the last known price rather than blanking the USD column.
    return priceCache?.usd[chain] ?? null;
  }
}

/* ── per-chain collectors ────────────────────────────────────── */

const TX_PAGE = 50;

export interface RawWallet {
  balance: number;
  tx_count: number;
  /** True only when the sample provably covers the address's whole history.
   *  Each collector decides this differently — see the per-chain notes. */
  history_complete: boolean;
  flow: { total_in: number; total_out: number; net: number } | null;
  transactions: TxSummary[];
  labels: string[];
  tokens: { symbol: string; name: string; amount: number | null }[];
  sources: string[];
  partial: string[];
}

export async function collectBitcoin(address: string): Promise<RawWallet> {
  const base = 'https://mempool.space/api';
  const info = await getJson(`${base}/address/${encodeURIComponent(address)}`);
  const cs = info.chain_stats || {};
  const sats = (n: number) => (Number(n) || 0) / 1e8;

  const totalIn = sats(cs.funded_txo_sum);
  const totalOut = sats(cs.spent_txo_sum);

  const partial: string[] = [];
  let transactions: TxSummary[] = [];
  try {
    const txs = await getJson(`${base}/address/${encodeURIComponent(address)}/txs`, 20000);
    transactions = (Array.isArray(txs) ? txs : []).map((t: any): TxSummary => {
      // Sum this address's side of the ledger on both legs of the tx.
      const inFrom = (t.vin || []).reduce(
        (s: number, v: any) => s + (v?.prevout?.scriptpubkey_address === address ? Number(v.prevout.value) || 0 : 0),
        0
      );
      const outTo = (t.vout || []).reduce(
        (s: number, v: any) => s + (v?.scriptpubkey_address === address ? Number(v.value) || 0 : 0),
        0
      );
      const spent = sats(inFrom);
      const received = sats(outTo);
      const direction: TxSummary['direction'] =
        spent > 0 && received > 0 ? 'self' : spent > 0 ? 'out' : received > 0 ? 'in' : 'unknown';

      // Counterparty = the largest party on the opposite leg.
      const pool =
        direction === 'out'
          ? (t.vout || []).filter((v: any) => v?.scriptpubkey_address && v.scriptpubkey_address !== address)
          : (t.vin || [])
              .map((v: any) => v?.prevout)
              .filter((p: any) => p?.scriptpubkey_address && p.scriptpubkey_address !== address);
      const top = pool.sort((a: any, b: any) => (Number(b?.value) || 0) - (Number(a?.value) || 0))[0];

      return {
        hash: t.txid,
        time: t.status?.block_time ? new Date(t.status.block_time * 1000).toISOString() : null,
        direction,
        value: direction === 'out' ? spent - received : received,
        counterparty: top?.scriptpubkey_address || null,
        fee: sats(t.fee),
      };
    });
  } catch (e) {
    partial.push(`transaction history unavailable (${e instanceof Error ? e.message : 'error'})`);
  }

  // mempool.space reports a true lifetime tx_count, so completeness is exact.
  const txCount = Number(cs.tx_count) || 0;
  return {
    balance: totalIn - totalOut,
    tx_count: txCount,
    history_complete: transactions.length >= txCount,
    flow: { total_in: totalIn, total_out: totalOut, net: totalIn - totalOut },
    transactions,
    labels: [],
    tokens: [],
    sources: ['mempool.space'],
    partial,
  };
}

export async function collectEthereum(address: string): Promise<RawWallet> {
  const base = 'https://eth.blockscout.com/api/v2';
  const info = await getJson(`${base}/addresses/${encodeURIComponent(address)}`);
  const balance = Number(info.coin_balance || 0) / 1e18;

  const labels: string[] = [];
  if (info.ens_domain_name) labels.push(`ENS: ${info.ens_domain_name}`);
  // Blockscout sets is_contract for any address holding code, including EOAs
  // carrying an EIP-7702 delegation — those have no deployment transaction.
  // Calling those "smart contract" is wrong, so distinguish on the creation tx.
  if (info.is_contract) {
    if (info.creation_transaction_hash) {
      labels.push(info.is_verified ? 'Smart contract (verified source)' : 'Smart contract');
    } else {
      labels.push('Code at address, no deployment tx (EIP-7702 delegation)');
    }
  }
  if (info.has_beacon_chain_withdrawals) labels.push('Beacon chain withdrawals');

  const partial: string[] = [];
  let transactions: TxSummary[] = [];
  let txCount = 0;
  try {
    const txs = await getJson(`${base}/addresses/${encodeURIComponent(address)}/transactions`, 25000);
    const items = Array.isArray(txs.items) ? txs.items : [];
    txCount = items.length;
    const lower = address.toLowerCase();
    transactions = items.map((t: any): TxSummary => {
      const from = (t.from?.hash || '').toLowerCase();
      const to = (t.to?.hash || '').toLowerCase();
      const direction: TxSummary['direction'] =
        from === lower && to === lower ? 'self' : from === lower ? 'out' : to === lower ? 'in' : 'unknown';
      return {
        hash: t.hash,
        time: t.timestamp || null,
        direction,
        value: Number(t.value || 0) / 1e18,
        counterparty: direction === 'out' ? t.to?.hash || null : t.from?.hash || null,
        fee: t.fee?.value ? Number(t.fee.value) / 1e18 : undefined,
        failed: t.status === 'error' || t.result === 'error',
      };
    });
  } catch (e) {
    partial.push(`transaction history unavailable (${e instanceof Error ? e.message : 'error'})`);
  }

  let tokens: RawWallet['tokens'] = [];
  try {
    const tb = await getJson(`${base}/addresses/${encodeURIComponent(address)}/token-balances`, 15000);
    tokens = (Array.isArray(tb) ? tb : [])
      .slice(0, 25)
      .map((t: any) => {
        const dec = Number(t.token?.decimals);
        const raw = Number(t.value);
        return {
          symbol: t.token?.symbol || '???',
          name: t.token?.name || 'Unknown token',
          amount: Number.isFinite(raw) && Number.isFinite(dec) ? raw / 10 ** dec : null,
        };
      });
  } catch {
    partial.push('token balances unavailable');
  }

  // Blockscout reports totals only across the paged window, so derive flow
  // from the transactions actually seen rather than implying a full history.
  const flow = transactions.length
    ? {
        total_in: transactions.filter(t => t.direction === 'in').reduce((s, t) => s + t.value, 0),
        total_out: transactions.filter(t => t.direction === 'out').reduce((s, t) => s + t.value, 0),
        net: 0,
      }
    : null;
  if (flow) flow.net = flow.total_in - flow.total_out;

  return {
    balance,
    tx_count: txCount,
    // Blockscout pages newest-first and exposes no lifetime total; a page that
    // came back short is the only proof we reached the beginning.
    history_complete: transactions.length > 0 && transactions.length < TX_PAGE,
    flow,
    transactions,
    labels,
    tokens,
    sources: ['Blockscout'],
    partial,
  };
}

export async function collectSolana(address: string): Promise<RawWallet> {
  const url = 'https://api.mainnet-beta.solana.com';
  const lamports = await rpc(url, 'getBalance', [address]);
  const balance = (Number(lamports?.value) || 0) / 1e9;

  const partial: string[] = [];
  let transactions: TxSummary[] = [];
  try {
    const sigs = await rpc(url, 'getSignaturesForAddress', [address, { limit: 50 }], 20000);
    transactions = (Array.isArray(sigs) ? sigs : []).map((s: any): TxSummary => ({
      hash: s.signature,
      time: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
      // Signature listings carry no transfer legs; resolving direction and
      // amounts needs a per-tx fetch, which the public RPC rate-limits hard.
      direction: 'unknown',
      value: 0,
      counterparty: null,
      failed: !!s.err,
    }));
  } catch (e) {
    partial.push(`signature history unavailable (${e instanceof Error ? e.message : 'error'})`);
  }
  partial.push('Solana transfer amounts and counterparties require a keyed RPC provider (HELIUS_API_KEY)');

  let tokens: RawWallet['tokens'] = [];
  try {
    const accs = await rpc(
      url,
      'getTokenAccountsByOwner',
      [address, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
      20000
    );
    tokens = (accs?.value || [])
      .slice(0, 25)
      .map((a: any) => {
        const info = a?.account?.data?.parsed?.info;
        return {
          symbol: (info?.mint || '').slice(0, 6) || '???',
          name: `SPL mint ${info?.mint || 'unknown'}`,
          amount: info?.tokenAmount?.uiAmount ?? null,
        };
      })
      .filter((t: any) => t.amount === null || t.amount > 0);
  } catch {
    partial.push('token accounts unavailable');
  }

  return {
    balance,
    tx_count: transactions.length,
    // Same reasoning as Ethereum: a full page means more signatures remain.
    history_complete: transactions.length > 0 && transactions.length < TX_PAGE,
    flow: null,
    transactions,
    labels: [],
    tokens,
    sources: ['Solana JSON-RPC'],
    partial,
  };
}
