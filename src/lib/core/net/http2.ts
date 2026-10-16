import http2 from 'node:http2';

/**
 * TAKIP — one request over HTTP/2, for hosts whose HTTP/1.1 headers undici rejects
 * (e.g. its.act.pr.gov sends " Permissions-Policy" with a leading space; HTTP/2 carries it cleanly).
 */
export function http2Request(url: string, { method = 'GET', headers = {}, body, timeoutMs = 15_000 }: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
} = {}): Promise<{ status: number; body: string }> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const session = http2.connect(target.origin);
    const timer = setTimeout(() => {
      session.destroy();
      reject(new Error(`HTTP/2 ${target.host}: timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    const fail = (e: Error) => {
      clearTimeout(timer);
      session.destroy();
      reject(e);
    };
    session.on('error', fail);

    const req = session.request({ ':method': method, ':path': `${target.pathname}${target.search}`, ...headers });
    let status = 0;
    const chunks: Buffer[] = [];
    req.on('response', h => { status = Number(h[':status']); });
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('error', fail);
    req.on('end', () => {
      clearTimeout(timer);
      session.close();
      resolve({ status, body: Buffer.concat(chunks).toString('utf8') });
    });
    req.end(body);
  });
}
