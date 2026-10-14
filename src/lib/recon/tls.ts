import tls from 'node:tls';
import { validateHost } from '@/lib/ssrf-guard';

export interface TlsReport {
  host: string;
  port: number;
  ok: boolean;
  protocol: string | null;
  cipher: string | null;
  valid: boolean;
  authorized: boolean;
  auth_error: string | null;
  issuer: string | null;
  subject: string | null;
  not_before: string | null;
  expires: string | null;
  days_left: number | null;
  sans: string[];
  san_match: boolean;
  error?: string;
}

const str = (v: unknown): string | null => (Array.isArray(v) ? (v[0] ?? null) : typeof v === 'string' ? v : null);

/** {C,O,CN} → the organisation a reader recognises. */
function dn(entry: tls.PeerCertificate['issuer'] | undefined): string | null {
  if (!entry) return null;
  return str(entry.O) || str(entry.CN) || str(entry.OU) || null;
}

/** `*.example.com` covers `a.example.com` but not `example.com`; an exact entry wins. */
function coversHost(names: string[], host: string): boolean {
  const h = host.toLowerCase();
  return names.some(raw => {
    const n = raw.toLowerCase();
    if (n === h) return true;
    if (n.startsWith('*.')) {
      const base = n.slice(2);
      return h.endsWith(`.${base}`) && h.slice(0, -base.length - 1).indexOf('.') === -1;
    }
    return false;
  });
}

/**
 * Open a real TLS connection to `host` and report the negotiated protocol,
 * cipher and the leaf certificate. The handshake is not aborted on an invalid
 * certificate (`rejectUnauthorized: false`) so an expired or mismatched cert
 * is described rather than hidden; the verdict lives in `authorized`.
 */
export async function inspectTls(host: string, port = 443, timeoutMs = 10_000): Promise<TlsReport> {
  const guard = await validateHost(host);
  const base: TlsReport = {
    host, port, ok: false, protocol: null, cipher: null, valid: false, authorized: false,
    auth_error: null, issuer: null, subject: null, not_before: null, expires: null,
    days_left: null, sans: [], san_match: false,
  };
  if (!guard.ok) return { ...base, error: guard.reason ?? 'blocked target' };

  // Connect to the resolved address but present the hostname as SNI, so we
  // reach the host DNS pointed at a moment ago, not whatever it resolves to now.
  const address = guard.resolved?.[0] ?? host;

  return new Promise<TlsReport>(resolve => {
    let settled = false;
    const done = (r: TlsReport) => { if (!settled) { settled = true; try { socket.destroy(); } catch { /* already gone */ } resolve(r); } };

    const socket = tls.connect({
      host: address,
      servername: host,
      port,
      rejectUnauthorized: false,
      ALPNProtocols: ['h2', 'http/1.1'],
      timeout: timeoutMs,
    }, () => {
      const cert = socket.getPeerCertificate(true);
      const cipher = socket.getCipher();
      const authError = socket.authorized ? null : (socket.authorizationError?.toString() ?? 'unauthorized');
      const sans = (cert?.subjectaltname ?? '')
        .split(',').map(s => s.trim().replace(/^DNS:/i, '')).filter(Boolean);
      const expires = cert?.valid_to ? new Date(cert.valid_to).toISOString() : null;
      const daysLeft = expires ? Math.round((new Date(expires).getTime() - Date.now()) / 86_400_000) : null;
      const sanMatch = sans.length ? coversHost(sans, host) : false;

      done({
        ...base,
        ok: true,
        protocol: socket.getProtocol(),
        cipher: cipher ? `${cipher.name} (${cipher.version})` : null,
        authorized: socket.authorized,
        auth_error: authError,
        valid: socket.authorized && sanMatch && (daysLeft ?? -1) >= 0,
        issuer: dn(cert?.issuer),
        subject: dn(cert?.subject) ?? str(cert?.subject?.CN),
        not_before: cert?.valid_from ? new Date(cert.valid_from).toISOString() : null,
        expires,
        days_left: daysLeft,
        sans,
        san_match: sanMatch,
      });
    });

    socket.on('timeout', () => done({ ...base, error: 'Connection timed out' }));
    socket.on('error', (e: Error) => done({ ...base, error: e.message }));
  });
}
