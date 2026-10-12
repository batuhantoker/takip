import type { DestinationStream } from 'pino';

const LABELS: Record<number, string> = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };
const HIDDEN = new Set(['level', 'time', 'pid', 'hostname', 'msg', 'err', 'requestId']);

type Entry = Record<string, unknown> & { level: number; msg?: string; err?: { stack?: string } };

/** Short `[api] …` lines shaped like Next's own request lines, since `npm run dev` interleaves both. */
export function devStream(out: { write(text: string): unknown } = process.stdout): DestinationStream {
  return { write: json => out.write(`[api] ${format(JSON.parse(json) as Entry)}\n`) };
}

function format(entry: Entry) {
  const label = entry.level >= 40 ? `${LABELS[entry.level]} ` : '';
  const stack = entry.err?.stack ? `\n${entry.err.stack}` : '';
  if (entry.msg === 'request') {
    const { method, path, status, durationMs, principal } = entry;
    return `${label}${method} ${path} ${status} in ${Math.round(Number(durationMs))}ms${principal ? ` (${principal})` : ''}${stack}`;
  }
  const fields = Object.entries(entry)
    .filter(([key]) => !HIDDEN.has(key))
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`);
  return `${label}${[entry.msg ?? '', ...fields].join(' ').trim()}${stack}`;
}
