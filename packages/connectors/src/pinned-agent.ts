import type { LookupAddress, LookupOptions } from 'node:dns';
import { isIP } from 'node:net';

/**
 * fetch() resolves a hostname again when it connects, which lets a rebinding DNS server answer the
 * check with a public address and the connection with 127.0.0.1. Only the lookup is pinned, so the
 * Host header, SNI and the certificate check still use the hostname.
 */

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
export type Lookup = (hostname: string, options: LookupOptions, callback: LookupCallback) => void;

/** A dispatcher, as fetch's `dispatcher` option takes it. */
export type Dispatcher = object;
type AgentClass = new (options: { connect: { lookup: Lookup } }) => Dispatcher;

/** A lookup that answers with `addresses` whatever the name, and never asks DNS. */
export function pinnedLookup(addresses: string[]): Lookup {
  const answers = addresses.map(address => ({ address, family: isIP(address) })).filter(a => a.family);
  return (_hostname, options, callback) => {
    const want = options.family === 4 || options.family === 'IPv4' ? 4 : options.family === 6 || options.family === 'IPv6' ? 6 : 0;
    const usable = want ? answers.filter(a => a.family === want) : answers;
    if (!usable.length) {
      callback(Object.assign(new Error('no checked address to connect to'), { code: 'ENOTFOUND' }), '');
      return;
    }
    // Node asks for every address when Happy Eyeballs is on.
    if (options.all) callback(null, usable);
    else callback(null, usable[0].address, usable[0].family);
  };
}

// Node 26's undici keeps its Agent under .2 and a compatibility wrapper under .1; Node 22 and 24 use .1.
const GLOBAL_DISPATCHERS = [Symbol.for('undici.globalDispatcher.2'), Symbol.for('undici.globalDispatcher.1')];
let agentClass: AgentClass | null = null;

/** Node's fetch is undici, which Node doesn't export; its Agent is the class of the global dispatcher. */
function undiciAgent(): AgentClass {
  if (agentClass) return agentClass;
  const slot = globalThis as unknown as Record<symbol, Dispatcher | undefined>;
  const installed = () => GLOBAL_DISPATCHERS.map(key => slot[key]).find(Boolean);
  // Undici installs its global dispatcher when Node first loads it, and any of its classes loads it.
  if (!installed()) void new Headers();
  const dispatcher = installed();
  const found = dispatcher && (Object.getPrototypeOf(dispatcher).constructor as AgentClass);
  // A proxy or mock dispatcher may ignore connect.lookup; refuse rather than connect unpinned.
  if (!found || found.name !== 'Agent') throw new Error('safeFetch: no undici Agent to pin connections with');
  agentClass = found;
  return found;
}

/** A dispatcher for fetch() whose connections go to `addresses` only. */
export function pinnedAgent(addresses: string[]): Dispatcher {
  const Agent = undiciAgent();
  return new Agent({ connect: { lookup: pinnedLookup(addresses) } });
}
