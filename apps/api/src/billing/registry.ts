import type { Env } from '../env';
import { createFakeProvider } from './fake-provider';
import type { BillingProvider, ProviderId } from './provider';

/** Real adapters, keyed by BILLING_PROVIDER. Empty until a provider is chosen (backend.md §7.4). */
const ADAPTERS: Partial<Record<Exclude<ProviderId, 'fake'>, (env: Env) => BillingProvider>> = {};

/** Why `id` can't be selected in this environment, or null when it can. */
export function unavailableReason(id: ProviderId, nodeEnv: Env['NODE_ENV']): string | null {
  if (id === 'fake') return nodeEnv === 'test' ? null : 'the fake provider is for tests only';
  return ADAPTERS[id] ? null : `no adapter for "${id}" yet`;
}

/** The configured provider, or null when billing is off (BILLING_PROVIDER unset). */
export function billingProviderFor(env: Env): BillingProvider | null {
  const id = env.BILLING_PROVIDER;
  if (!id) return null;
  const reason = unavailableReason(id, env.NODE_ENV);
  if (reason) throw new Error(`BILLING_PROVIDER: ${reason}`);
  return id === 'fake' ? createFakeProvider() : ADAPTERS[id]!(env);
}
