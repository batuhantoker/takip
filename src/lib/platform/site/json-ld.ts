/** JSON for a `<script type="application/ld+json">`, with `<` escaped so no value can close the tag. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** A breadcrumb trail, home first. Paths are site-relative. */
export function breadcrumbs(origin: string, trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: `${origin}${t.path}` })),
  };
}
