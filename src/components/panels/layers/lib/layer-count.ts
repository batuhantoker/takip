/** Live item count for a layer, or null when its data has not arrived or there is nothing to count. */
export function layerCount(data: Record<string, unknown> | null | undefined, dataKey: string, catKey?: string): number | null {
  if (!dataKey || !data) return null;
  const buckets = data.category_counts as Record<string, number> | undefined;
  if (catKey && buckets) return buckets[catKey] || 0;
  let total = 0;
  let found = false;
  for (const key of dataKey.split(',')) {
    const items = data[key];
    if (Array.isArray(items)) {
      total += items.length;
      found = true;
    }
  }
  return found ? total : null;
}
