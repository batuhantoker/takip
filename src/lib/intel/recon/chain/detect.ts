import type { SanctionEntry } from '../sanctions';

export type Chain = 'bitcoin' | 'ethereum' | 'solana';

export const CHAIN_META: Record<Chain, { label: string; symbol: string; decimals: number; coingecko: string }> = {
  bitcoin: { label: 'Bitcoin', symbol: 'BTC', decimals: 8, coingecko: 'bitcoin' },
  ethereum: { label: 'Ethereum', symbol: 'ETH', decimals: 18, coingecko: 'ethereum' },
  solana: { label: 'Solana', symbol: 'SOL', decimals: 9, coingecko: 'solana' },
};

const RE_ETH = /^0x[a-fA-F0-9]{40}$/;
const RE_BTC_BECH32 = /^bc1[a-z0-9]{25,62}$/;
const RE_BTC_LEGACY = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const RE_BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface ChainDetection {
  chain: Chain | null;
  /** Base58 lengths overlap between BTC legacy and Solana; true when the
   *  format alone cannot decide and `chain` is a best guess. */
  ambiguous: boolean;
}

/**
 * Format-based chain detection. Order matters: ETH and bech32 are
 * unambiguous, while a 32–34 char base58 string beginning 1/3 is valid for
 * both BTC legacy and Solana — those resolve to BTC and set `ambiguous`,
 * which the caller can override with an explicit chain.
 */
export function detectChain(addressRaw: string): ChainDetection {
  const address = addressRaw.trim();
  if (RE_ETH.test(address)) return { chain: 'ethereum', ambiguous: false };
  if (RE_BTC_BECH32.test(address)) return { chain: 'bitcoin', ambiguous: false };
  if (RE_BTC_LEGACY.test(address)) {
    return { chain: 'bitcoin', ambiguous: RE_BASE58.test(address) };
  }
  if (RE_BASE58.test(address)) return { chain: 'solana', ambiguous: false };
  return { chain: null, ambiguous: false };
}

export interface Counterparty {
  address: string;
  direction: 'in' | 'out' | 'both';
  txs: number;
  value: number;
}

export interface TxSummary {
  hash: string;
  time: string | null;
  direction: 'in' | 'out' | 'self' | 'unknown';
  value: number;
  counterparty: string | null;
  fee?: number;
  failed?: boolean;
}

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  code: string;
  label: string;
  severity: Severity;
  /** Points contributed to the 0–100 score. */
  weight: number;
  /** The observation that triggered it — always states the evidence. */
  detail: string;
  /** The numbers and names in `detail`, so a client can say it in the reader's language. */
  vars?: Record<string, string | number>;
}

export interface WalletIntel {
  address: string;
  chain: Chain;
  chain_label: string;
  symbol: string;
  ambiguous_chain: boolean;
  balance: { native: number; usd: number | null; price_usd: number | null };
  activity: {
    tx_count: number;
    /** Earliest transaction *in the sampled window* — not necessarily the
     *  address's first ever, unless `history_complete` is true. */
    first_seen: string | null;
    last_seen: string | null;
    /** Null whenever history is incomplete: the true first transaction is
     *  older than the sample and any age derived from it would be wrong. */
    age_days: number | null;
    dormant_days: number | null;
    sample_size: number;
    history_complete: boolean;
  };
  flow: { total_in: number; total_out: number; net: number } | null;
  counterparties: Counterparty[];
  transactions: TxSummary[];
  sanctions: { screened: boolean; hit: boolean; entries: SanctionEntry[] };
  risk: { score: number; level: Severity; factors: RiskFactor[] };
  labels: string[];
  tokens: { symbol: string; name: string; amount: number | null }[];
  sources: string[];
  partial: string[];
}
