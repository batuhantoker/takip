import { Swatch } from '@/components/panels/history/parts/swatch';
import { LayerSwatch } from '@/components/panels/layers/parts/layer-swatch';
import type { RowSwatch } from '@/components/shell/showing/lib/showing-rows';

/** A ramp blends; several colours of one kind (powers, alliances) sit side by side. */
function fill(shape: string, colors: string[]) {
  if (colors.length < 2) return colors[0];
  if (shape === 'bar') return `linear-gradient(90deg, ${colors.join(', ')})`;
  const step = 100 / colors.length;
  return `linear-gradient(90deg, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

/** The row's key to the map, drawn as the Layers and History panels draw it; grey while switched off. */
export function ShowingSwatch({ swatch, on }: { swatch: RowSwatch; on: boolean }) {
  if (swatch.kind === 'layer') return <LayerSwatch layerKey={swatch.key} on={on} />;
  return (
    <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
      <Swatch shape={swatch.shape} color={swatch.colors[0] ?? ''} off={!on} style={on ? { background: fill(swatch.shape, swatch.colors) } : undefined} />
    </span>
  );
}
