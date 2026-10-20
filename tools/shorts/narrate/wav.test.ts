import { describe, expect, it } from 'vitest';
import { durationMs, lay, readWav, writeWav } from './wav';

const tone = (n: number, v: number) => ({ rate: 1000, samples: new Float32Array(n).fill(v) });

describe('wav', () => {
  it('round-trips 16-bit mono', () => {
    const back = readWav(writeWav(tone(500, 0.5)));
    expect(back.rate).toBe(1000);
    expect(durationMs(back)).toBe(500);
    expect(back.samples[10]).toBeCloseTo(0.5, 3);
  });

  it('reads 32-bit float', () => {
    const pcm = writeWav(tone(4, 0));
    const buf = Buffer.alloc(44 + 16);
    pcm.copy(buf, 0, 0, 44);
    buf.writeUInt16LE(3, 20);
    buf.writeUInt16LE(32, 34);
    buf.writeUInt32LE(16, 40);
    [0.25, -0.5, 1, 0].forEach((v, i) => buf.writeFloatLE(v, 44 + i * 4));
    expect(Array.from(readWav(buf).samples)).toEqual([0.25, -0.5, 1, 0]);
  });

  it('lays clips at their times on silence', () => {
    const track = lay([{ atMs: 100, pcm: tone(50, 0.5) }, { atMs: 400, pcm: tone(50, -0.25) }], 600);
    expect(track.samples.length).toBe(600);
    expect(track.samples[99]).toBe(0);
    expect(track.samples[100]).toBe(0.5);
    expect(track.samples[420]).toBe(-0.25);
    expect(track.samples[500]).toBe(0);
  });
});
