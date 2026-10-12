const EXACT: Record<string, string> = { '/health': 'health', '/metrics': 'metrics' };
const PREFIXES: [prefix: string, group: string][] = [
  ['/api/auth/', 'auth'],
  ['/api/admin/', 'admin'],
  ['/api/v1/', 'v1'],
];

/** A fixed set of names, so requests for arbitrary paths can't grow label cardinality. */
export function routeGroup(path: string) {
  return EXACT[path] ?? PREFIXES.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'other';
}
