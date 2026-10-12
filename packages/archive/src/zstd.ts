import zlib from 'node:zlib';

// node:zlib has zstd since Node 22.15; the repo's @types/node 20 doesn't declare it yet.
type Zstd = {
  zstdCompress?: (buf: Buffer, cb: (error: Error | null, out: Buffer) => void) => void;
  zstdCompressSync?: (buf: Buffer) => Buffer;
  zstdDecompressSync?: (buf: Uint8Array) => Buffer;
};

export const zstd = zlib as unknown as Zstd;
