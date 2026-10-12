/*
 * Splits a file of concatenated zstd frames (RFC 8878 §3.1). Needed because node:zlib's zstd
 * decoder, sync and streaming alike, silently stops after the first frame.
 */

const ZSTD_MAGIC = 0xfd2fb528;
const SKIPPABLE_MASK = 0xfffffff0;
const SKIPPABLE_MAGIC = 0x184d2a50;

const DID_BYTES = [0, 1, 2, 4];
const FCS_BYTES = [0, 2, 4, 8];

/** Complete frames in order; `truncated` when the tail is a frame still being written or cut off by a crash. */
export function splitZstdFrames(buf: Uint8Array): { frames: Uint8Array[]; truncated: boolean } {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const frames: Uint8Array[] = [];
  let pos = 0;
  while (pos < buf.length) {
    if (pos + 4 > buf.length) return { frames, truncated: true };
    const magic = view.getUint32(pos, true);
    if ((magic & SKIPPABLE_MASK) >>> 0 === SKIPPABLE_MAGIC) {
      if (pos + 8 > buf.length) return { frames, truncated: true };
      const end = pos + 8 + view.getUint32(pos + 4, true);
      if (end > buf.length) return { frames, truncated: true };
      pos = end;
      continue;
    }
    if (magic !== ZSTD_MAGIC) throw new Error(`not a zstd frame at byte ${pos}`);
    const end = frameEnd(buf, pos);
    if (end === undefined) return { frames, truncated: true };
    frames.push(buf.subarray(pos, end));
    pos = end;
  }
  return { frames, truncated: false };
}

function frameEnd(buf: Uint8Array, start: number): number | undefined {
  let pos = start + 4;
  if (pos >= buf.length) return undefined;
  const fhd = buf[pos++];
  const fcsFlag = fhd >> 6;
  const singleSegment = (fhd >> 5) & 1;
  const checksum = (fhd >> 2) & 1;
  if (!singleSegment) pos += 1;
  pos += DID_BYTES[fhd & 3];
  pos += fcsFlag === 0 ? singleSegment : FCS_BYTES[fcsFlag];
  for (;;) {
    if (pos + 3 > buf.length) return undefined;
    const header = buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16);
    pos += 3;
    const type = (header >> 1) & 3;
    if (type === 3) throw new Error(`reserved zstd block type at byte ${pos - 3}`);
    // An RLE block stores one byte however large it expands.
    pos += type === 1 ? 1 : header >>> 3;
    if (header & 1) break;
  }
  if (checksum) pos += 4;
  return pos <= buf.length ? pos : undefined;
}
