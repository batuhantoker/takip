/** Just enough WAV to lay voice clips on one track: PCM 16-bit or float 32-bit in, mono 16-bit out. */

export interface Pcm { rate: number; samples: Float32Array }

export function readWav(buf: Buffer): Pcm {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let format = 0, channels = 1, rate = 0, bits = 16;
  for (let at = 12; at + 8 <= buf.length;) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === 'fmt ') {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
      // WAVE_FORMAT_EXTENSIBLE keeps the real format in its sub-format GUID
      if (format === 0xfffe) format = buf.readUInt16LE(body + 24);
    } else if (id === 'data') {
      const end = Math.min(buf.length, body + size);
      const step = (bits / 8) * channels;
      const n = Math.floor((end - body) / step);
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = body + i * step;
        if (format === 3 && bits === 32) samples[i] = buf.readFloatLE(p);
        else if (format === 1 && bits === 16) samples[i] = buf.readInt16LE(p) / 32768;
        else if (format === 1 && bits === 32) samples[i] = buf.readInt32LE(p) / 2147483648;
        else throw new Error(`unsupported WAV: format ${format}, ${bits} bits`);
      }
      return { rate, samples };
    }
    at = body + size + (size % 2);
  }
  throw new Error('WAV has no data');
}

export function writeWav({ rate, samples }: Pcm): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buf;
}

export const durationMs = (pcm: Pcm) => (pcm.samples.length / pcm.rate) * 1000;

/** Clips laid at their start times on a silent track of the given length. */
export function lay(clips: { atMs: number; pcm: Pcm }[], totalMs: number): Pcm {
  const rate = clips[0]?.pcm.rate ?? 24000;
  const out = new Float32Array(Math.ceil((totalMs / 1000) * rate));
  for (const { atMs, pcm } of clips) {
    if (pcm.rate !== rate) throw new Error(`clips differ in sample rate: ${pcm.rate} vs ${rate}`);
    const from = Math.round((atMs / 1000) * rate);
    for (let i = 0; i < pcm.samples.length && from + i < out.length; i++) out[from + i] += pcm.samples[i];
  }
  return { rate, samples: out };
}
