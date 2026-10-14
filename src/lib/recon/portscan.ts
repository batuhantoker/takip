import net from 'node:net';
import { validateHost } from '@/lib/ssrf-guard';
import { COMMON_PORTS } from './ports';

export interface PortResult { port: number; state: 'open'; service: string }
export interface PortScanReport {
  host: string;
  address: string;
  ports: PortResult[];
  scanned: number;
  duration: string;
  error?: string;
}

function probe(address: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    // resolve() ignores all but the first call, so each path can settle freely.
    const finish = (v: boolean) => { resolve(v); socket.destroy(); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.once('close', () => resolve(false));
    socket.connect(port, address);
  });
}

/**
 * A live TCP-connect scan of the common ports. Each probe opens a real socket
 * to the resolved address and counts the port open only on a completed
 * handshake. `validateHost` keeps the scan off private and reserved ranges, so
 * this can't be aimed at internal infrastructure.
 */
export async function scanPorts(host: string, timeoutMs = 2000): Promise<PortScanReport> {
  const guard = await validateHost(host);
  const base: PortScanReport = { host, address: host, ports: [], scanned: COMMON_PORTS.length, duration: '0s' };
  if (!guard.ok) return { ...base, error: guard.reason ?? 'blocked target' };

  const address = guard.resolved?.[0] ?? host;
  const t0 = Date.now();
  const results = await Promise.all(
    COMMON_PORTS.map(async ([port, service]): Promise<PortResult | null> =>
      (await probe(address, port, timeoutMs)) ? { port, state: 'open', service } : null),
  );
  return {
    ...base,
    address,
    ports: results.filter((p): p is PortResult => p !== null),
    duration: `${((Date.now() - t0) / 1000).toFixed(1)}s`,
  };
}
