import { createHash } from 'node:crypto';

/**
 * The fingerprint, creation date and user IDs of an armored OpenPGP public
 * key. keys.openpgp.org only publishes a user ID once its owner has proved
 * control of the address, so a key found there ties the address to the name
 * on it. Just enough of RFC 4880 / 9580 packet framing to read tags 6 and 13.
 */

export interface PgpKey {
  fingerprint: string;
  created?: string;
  uids: string[];
}

function dearmor(armored: string): Buffer | null {
  const body = armored.match(/-----BEGIN PGP PUBLIC KEY BLOCK-----([\s\S]*?)-----END PGP PUBLIC KEY BLOCK-----/);
  if (!body) return null;
  // Headers ("Comment: …") end at the first blank line; the CRC line starts with "=".
  const [, ...rest] = body[1].replace(/\r/g, '').split(/\n\s*\n/);
  const b64 = rest.join('\n').split('\n').filter(l => l && !l.startsWith('=')).join('');
  return b64 ? Buffer.from(b64, 'base64') : null;
}

export function parsePgpKey(armored: string): PgpKey | null {
  const buf = dearmor(armored);
  if (!buf) return null;
  let i = 0;
  let key: PgpKey | null = null;

  while (i < buf.length) {
    const head = buf[i++];
    if (!(head & 0x80)) break;
    let tag: number;
    let len: number;
    if (head & 0x40) {
      tag = head & 0x3f;
      const o1 = buf[i++];
      if (o1 < 192) len = o1;
      else if (o1 < 224) len = ((o1 - 192) << 8) + buf[i++] + 192;
      else if (o1 === 255) { len = buf.readUInt32BE(i); i += 4; }
      else break; // partial lengths never appear in key packets
    } else {
      tag = (head >> 2) & 0x0f;
      const type = head & 0x03;
      if (type === 0) len = buf[i++];
      else if (type === 1) { len = buf.readUInt16BE(i); i += 2; }
      else if (type === 2) { len = buf.readUInt32BE(i); i += 4; }
      else break;
    }
    const packet = buf.subarray(i, i + len);
    i += len;

    if (tag === 6 && !key) {
      const version = packet[0];
      const created = packet.length >= 5 ? new Date(packet.readUInt32BE(1) * 1000).toISOString().slice(0, 10) : undefined;
      let fingerprint: string;
      if (version === 6) {
        const prefix = Buffer.alloc(5);
        prefix[0] = 0x9b;
        prefix.writeUInt32BE(packet.length, 1);
        fingerprint = createHash('sha256').update(prefix).update(packet).digest('hex');
      } else {
        fingerprint = createHash('sha1').update(Buffer.from([0x99, packet.length >> 8, packet.length & 0xff])).update(packet).digest('hex');
      }
      key = { fingerprint: fingerprint.toUpperCase(), created, uids: [] };
    } else if (tag === 13 && key) {
      key.uids.push(packet.toString('utf8'));
    }
  }
  return key;
}
