import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { validateHost } from '@/lib/core/net/ssrf-guard';
import { COMODO_OV_INTERMEDIATE } from './ibb-cert';

/**
 * TAKIP — relays İBB's traffic-camera HLS (hls.ibb.gov.tr) for viewers outside Turkey.
 *
 * The host publishes four addresses, and from abroad only İBB's own (185.68.222.42) serves: 185.68.223.42 refuses,
 * and the Türk Telekom and Superonline ones reset the TLS handshake. A browser does not retry another address after
 * a reset, so a direct stream fails most of the time. Here each published address is tried in turn and the one that
 * answered is tried first next time. Measured from the US on 2026-10-12 and 2026-10-13.
 * That address also omits its intermediate certificate, which browsers fetch for themselves and Node does not.
 */

export const IBB_HLS_HOST = 'hls.ibb.gov.tr';
/** A stream's playlist and the chunklists and segments beside it: tkm2/hls/4.stream/playlist.m3u8. */
export const IBB_HLS_PATH = /^tkm\d{1,2}\/hls\/\d{1,6}\.stream\/[\w.-]{1,100}\.(?:m3u8|ts)$/;
/** Relative names in the playlist resolve against this path, so nothing in it needs rewriting. */
export const IBB_RELAY = '/api/cctv/ibb/hls/';

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const ATTEMPT_TIMEOUT_MS = 5_000;
const MAX_BYTES = 16 * 1024 * 1024;
const agent = new https.Agent({ keepAlive: true, maxSockets: 32, ca: [...tls.rootCertificates, COMODO_OV_INTERMEDIATE] });
let lastGood: string | null = null;

export interface IbbHlsResponse {
  status: number;
  body: Buffer;
}

/** Fetches one stream file. Throws only when no address answered; an HTTP error status is returned. */
export async function fetchIbbHls(path: string): Promise<IbbHlsResponse> {
  if (!IBB_HLS_PATH.test(path)) throw new Error('Not an İBB stream path');
  const check = await validateHost(IBB_HLS_HOST);
  const resolved = check.ok ? check.resolved ?? [] : [];
  if (!resolved.length) throw new Error('İBB stream host has no public address');

  const good = lastGood;
  const order = good && resolved.includes(good) ? [good, ...resolved.filter(a => a !== good)] : resolved;
  let lastError: unknown;
  for (const address of order) {
    try {
      const res = await getVia(address, path);
      lastGood = address;
      return res;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('No İBB address answered');
}

function getVia(address: string, path: string): Promise<IbbHlsResponse> {
  return new Promise((resolve, reject) => {
    const family = net.isIPv6(address) ? 6 : 4;
    // Only the address is pinned; the TLS name and Host header still come from IBB_HLS_HOST.
    // Answered a turn later, as dns.lookup does: a synchronous answer lets an instant connect failure (no route)
    // raise its error before the request listens for it, which crashes the process.
    const lookup = (_host: string, opts: { all?: boolean }, cb: (err: null, addr: unknown, family?: number) => void) =>
      setImmediate(() => cb(null, opts?.all ? [{ address, family }] : address, family));
    const req = https.get(
      { host: IBB_HLS_HOST, path: `/${path}`, agent, lookup, timeout: ATTEMPT_TIMEOUT_MS, headers: { 'User-Agent': UA } } as https.RequestOptions,
      res => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) req.destroy(new Error('İBB stream file too large'));
          else chunks.push(chunk);
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 502, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout')));
  });
}
