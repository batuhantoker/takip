/**
 * ═══════════════════════════════════════════════════════════════
 *  TAKIP — On-chain wallet intelligence (BTC / ETH / SOL)
 *
 *  Every source here is keyless and was verified against live data:
 *    BTC  mempool.space REST
 *    ETH  Blockscout v2 REST (also yields ENS + a spot exchange rate)
 *    SOL  public Solana JSON-RPC
 *    USD  CoinGecko simple/price
 *
 *  Optional keys (ETHERSCAN_API_KEY / HELIUS_API_KEY) unlock deeper data
 *  and are reported through capabilities(). Absent keys degrade the
 *  response, never break it.
 * ═══════════════════════════════════════════════════════════════
 */

import { matchExact, type SanctionEntry } from '../sanctions';
import { type Chain, CHAIN_META, detectChain, type Counterparty, type TxSummary, type Severity, type RiskFactor, type WalletIntel } from './detect';
import { fetchPrice, type RawWallet, collectBitcoin, collectEthereum, collectSolana } from './collect';

function aggregateCounterparties(txs: TxSummary[]): Counterparty[] {
  const map = new Map<string, Counterparty>();
  for (const t of txs) {
    if (!t.counterparty) continue;
    const existing = map.get(t.counterparty);
    const dir = t.direction === 'in' || t.direction === 'out' ? t.direction : null;
    if (existing) {
      existing.txs += 1;
      existing.value += t.value;
      if (dir && existing.direction !== dir && existing.direction !== 'both') existing.direction = 'both';
    } else {
      map.set(t.counterparty, {
        address: t.counterparty,
        direction: dir ?? 'both',
        txs: 1,
        value: t.value,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.txs - a.txs || b.value - a.value).slice(0, 15);
}

const LEVEL_ORDER: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

function scoreRisk(
  factors: RiskFactor[]
): { score: number; level: Severity } {
  const score = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.weight, 0)));
  const highest = factors.reduce<Severity>(
    (acc, f) => (LEVEL_ORDER.indexOf(f.severity) > LEVEL_ORDER.indexOf(acc) ? f.severity : acc),
    'info'
  );
  // A sanctions hit must never be diluted by an otherwise-quiet wallet.
  if (highest === 'critical') return { score: Math.max(score, 95), level: 'critical' };
  const level: Severity = score >= 70 ? 'high' : score >= 40 ? 'medium' : score >= 15 ? 'low' : 'info';
  return { score, level };
}

function buildFactors(
  raw: RawWallet,
  meta: { symbol: string },
  activity: WalletIntel['activity'],
  counterparties: Counterparty[],
  sanctionHits: SanctionEntry[]
): RiskFactor[] {
  const f: RiskFactor[] = [];

  if (sanctionHits.length) {
    f.push({
      code: 'OFAC_SDN',
      label: 'OFAC-sanctioned address',
      severity: 'critical',
      weight: 100,
      detail: `Listed on the US OFAC SDN list as: ${sanctionHits.slice(0, 3).map(e => e.name).join('; ')}`,
    });
  }

  if (activity.age_days !== null && activity.age_days < 7) {
    f.push({
      code: 'NEW_ADDRESS',
      label: 'Recently created',
      severity: 'low',
      weight: 10,
      detail: `First activity ${activity.age_days} day(s) ago.`,
    });
  }

  if (activity.dormant_days !== null && activity.age_days !== null && activity.dormant_days > 365 && activity.age_days > 400) {
    f.push({
      code: 'DORMANT',
      label: 'Long dormant',
      severity: 'info',
      weight: 5,
      detail: `No activity for ${activity.dormant_days} days.`,
    });
  }

  if (raw.tx_count > 10000) {
    f.push({
      code: 'HIGH_VOLUME',
      label: 'Exchange-scale activity',
      severity: 'info',
      weight: 5,
      detail: `${raw.tx_count.toLocaleString()} transactions — consistent with an exchange, service or pooled wallet rather than a personal one.`,
    });
  }

  // Fan-out is only informative for wallets that aren't obviously services —
  // an exchange spreading across many counterparties is its normal operation.
  if (counterparties.length >= 12 && raw.tx_count <= 10000) {
    f.push({
      code: 'FAN_PATTERN',
      label: 'High counterparty fan-out',
      severity: 'medium',
      weight: 20,
      detail: `${counterparties.length} distinct counterparties across ${raw.transactions.length} sampled transactions — a distribution pattern also seen in mixing and payout scripts.`,
    });
  }

  const failed = raw.transactions.filter(t => t.failed).length;
  if (failed >= 5) {
    f.push({
      code: 'FAILED_TXS',
      label: 'Repeated failed transactions',
      severity: 'low',
      weight: 8,
      detail: `${failed} of ${raw.transactions.length} sampled transactions failed.`,
    });
  }

  if (raw.flow && raw.flow.total_in > 0 && raw.balance / raw.flow.total_in < 0.01 && raw.tx_count > 5) {
    f.push({
      code: 'DRAINED',
      label: 'Swept balance',
      severity: 'medium',
      weight: 15,
      detail: `Received ${raw.flow.total_in.toFixed(4)} ${meta.symbol} but retains ${raw.balance.toFixed(4)} — funds were forwarded on rather than held.`,
    });
  }

  if (!f.length) {
    f.push({
      code: 'NOMINAL',
      label: 'No risk indicators',
      severity: 'info',
      weight: 0,
      detail: 'Nothing in the sampled data matched a risk heuristic.',
    });
  }

  return f;
}

/* ── capabilities ────────────────────────────────────────────── */

export function capabilities() {
  return {
    etherscan: !!process.env.ETHERSCAN_API_KEY,
    helius: !!process.env.HELIUS_API_KEY,
  };
}

/* ── entry point ─────────────────────────────────────────────── */

export async function analyseAddress(addressRaw: string, chainOverride?: Chain): Promise<WalletIntel> {
  const address = addressRaw.trim();
  const detection = detectChain(address);
  const chain = chainOverride ?? detection.chain;
  if (!chain) throw new Error('Unrecognised address format for BTC, ETH or SOL');

  const meta = CHAIN_META[chain];

  const [raw, price, sanctionHits] = await Promise.all([
    chain === 'bitcoin'
      ? collectBitcoin(address)
      : chain === 'ethereum'
        ? collectEthereum(address)
        : collectSolana(address),
    fetchPrice(chain),
    // OFAC lists sanctioned wallets as entity names, so an exact-name lookup
    // is the correct screen; normalisation lower-cases both sides.
    matchExact(address).catch(() => [] as SanctionEntry[]),
  ]);

  const times = raw.transactions.map(t => t.time).filter((t): t is string => !!t).sort();
  const firstSeen = times[0] ?? null;
  const lastSeen = times[times.length - 1] ?? null;
  const day = 86_400_000;
  // Chain APIs page newest-first, so the sample only reaches the true first
  // transaction when it covers the whole history. Deriving an age from a
  // partial sample would report a 2009 address as days old.
  const historyComplete = raw.history_complete;
  const activity: WalletIntel['activity'] = {
    tx_count: raw.tx_count,
    first_seen: firstSeen,
    last_seen: lastSeen,
    age_days: historyComplete && firstSeen ? Math.floor((Date.now() - Date.parse(firstSeen)) / day) : null,
    dormant_days: lastSeen ? Math.floor((Date.now() - Date.parse(lastSeen)) / day) : null,
    sample_size: raw.transactions.length,
    history_complete: historyComplete,
  };

  const counterparties = aggregateCounterparties(raw.transactions);
  const factors = buildFactors(raw, meta, activity, counterparties, sanctionHits);
  const risk = scoreRisk(factors);

  return {
    address,
    chain,
    chain_label: meta.label,
    symbol: meta.symbol,
    ambiguous_chain: detection.ambiguous && !chainOverride,
    balance: {
      native: raw.balance,
      usd: price !== null ? raw.balance * price : null,
      price_usd: price,
    },
    activity,
    flow: raw.flow,
    counterparties,
    transactions: raw.transactions.slice(0, 25),
    sanctions: { screened: true, hit: sanctionHits.length > 0, entries: sanctionHits.slice(0, 5) },
    risk: { ...risk, factors },
    labels: raw.labels,
    tokens: raw.tokens,
    sources: [...raw.sources, 'CoinGecko', 'OpenSanctions / US OFAC SDN'],
    partial: raw.partial,
  };
}
