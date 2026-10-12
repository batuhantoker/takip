/** 45° hairlines on transparent, 8 px repeat, for map.addImage and fill-pattern. */
export function hatchImage([r, g, b, a]: [number, number, number, number]): { width: number; height: number; data: Uint8Array } {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if ((x + y) % size === 0) data.set([r, g, b, a], (y * size + x) * 4);
  }
  return { width: size, height: size, data };
}
