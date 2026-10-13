import { detectQuery, type QueryKind } from './detect-query';

type Named = { id: string; label: string; aliases?: string };

export interface Suggestion {
  id: string;
  /** `run` looks the query up with the tool; `open` opens the tool, as when the query was the tool's own name. */
  action: 'run' | 'open';
}

export interface SuggestionGroup {
  label: string;
  items: Suggestion[];
}

/** Tools whose name, id or aliases contain every word typed. Descriptions are left out: they match too loosely here. */
export function matchNames<T extends Named>(query: string, tools: T[]): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return tools.filter(t => {
    const hay = `${t.label} ${t.id} ${t.aliases ?? ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

// A bare word reads as a username, but it is as likely to be a tool's name.
const WEAK: ReadonlySet<QueryKind> = new Set(['username', 'unknown']);

/** What to offer under the Recon field, best first: Enter takes the first item of the first group. */
export function suggestTools(query: string, tools: Named[]): SuggestionGroup[] {
  const detection = detectQuery(query);
  const detected: SuggestionGroup | null = detection.tools.length
    ? { label: detection.label, items: detection.tools.map(id => ({ id, action: 'run' as const })) }
    : null;
  if (!WEAK.has(detection.kind)) return detected ? [detected] : [];

  const named = matchNames(query, tools);
  const byName: SuggestionGroup | null = named.length
    ? { label: 'Open a tool', items: named.map(t => ({ id: t.id, action: 'open' as const })) }
    : null;
  return [byName, detected].filter((g): g is SuggestionGroup => g !== null);
}

export const flatSuggestions = (groups: SuggestionGroup[]) => groups.flatMap(g => g.items);

/** Profile search has its own three modes; pick the one the query reads as. */
export function profileMode(query: string): 'username' | 'email' | 'phone' {
  const kind = detectQuery(query).kind;
  return kind === 'email' ? 'email' : kind === 'phone' ? 'phone' : 'username';
}
