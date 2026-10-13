// MapLibre paints with real colour strings, so read the categorical tokens instead of copying their values.
const TOKENS = [['--blue', 'Blue'], ['--violet', 'Violet'], ['--green', 'Green'], ['--amber', 'Amber'], ['--red', 'Red']] as const;

/** Colours for imported layers, named, in the order they are handed out. Empty during server render. */
export function layerSwatches(): { name: string; color: string }[] {
  if (typeof document === 'undefined') return [];
  const css = getComputedStyle(document.documentElement);
  return TOKENS.map(([token, name]) => ({ name, color: css.getPropertyValue(token).trim() })).filter(s => s.color);
}

const layerPalette = () => layerSwatches().map(s => s.color);

/** The first palette colour no layer is using yet, cycling once all are taken. */
export function nextLayerColor(used: string[]): string {
  const palette = layerPalette();
  return palette.find(c => !used.includes(c)) ?? palette[used.length % palette.length] ?? 'currentColor';
}
