/* /api/news answers with its own `timestamp` and `total`; merged at the root
   they would be overwritten by the next endpoint, so the feed keeps its
   metadata under its own key. */
export const newsTransform = (d: { news?: unknown[]; sources?: unknown[]; timestamp?: string }) => ({
  news: d.news,
  news_meta: { sources: d.sources ?? [], fetchedAt: d.timestamp ?? null },
  /* The reports that resolved to a place they name — the Live Alert Pins layer. */
  alert_pins: (d.news ?? []).filter(n => (n as { place?: unknown } | null)?.place),
});
