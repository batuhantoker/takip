/* Builds GNU tar bytes for tests, as adsb.lol's history releases are made. */
const enc = new TextEncoder();

function header(name: string, length: number, type = '0', magic = 'ustar ') {
  const h = new Uint8Array(512);
  h.set(enc.encode(name).subarray(0, 100), 0);
  h.set(enc.encode(length.toString(8).padStart(11, '0')), 124);
  h[156] = type.charCodeAt(0);
  h.set(enc.encode(magic), 257);
  return h;
}

export function tar(entries: { name: string; data: Uint8Array; type?: string }[]) {
  const parts: Uint8Array[] = [];
  for (const { name, data, type } of entries) {
    if (name.length > 100) {
      const long = enc.encode(`${name}\0`);
      parts.push(header('././@LongLink', long.length, 'L'), long, new Uint8Array((512 - (long.length % 512)) % 512));
    }
    parts.push(header(name.slice(0, 100), data.length, type ?? '0'), data, new Uint8Array((512 - (data.length % 512)) % 512));
  }
  parts.push(new Uint8Array(1024));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
