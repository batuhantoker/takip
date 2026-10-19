/**
 * A small subset of ICU MessageFormat: `{name}`, `{n, plural, =0 {…} one {# item} other {# items}}` and
 * `{kind, select, ship {…} other {…}}`. Numbers are formatted for the locale; `#` is the plural's number.
 * Literal braces aren't supported.
 */

type Node = string | { arg: string } | { arg: string; kind: 'plural' | 'select'; branches: Record<string, Node[]> } | { hash: true };

const parsed = new Map<string, Node[]>();

function parse(src: string, from = 0, branch = false, inPlural = false): { nodes: Node[]; end: number } {
  const nodes: Node[] = [];
  let text = '';
  let i = from;
  const flush = () => { if (text) nodes.push(text); text = ''; };
  while (i < src.length) {
    const c = src[i];
    if (c === '}' && branch) break;
    if (c === '#' && inPlural) { flush(); nodes.push({ hash: true }); i++; continue; }
    if (c !== '{') { text += c; i++; continue; }
    const close = src.indexOf('}', i);
    const comma = src.indexOf(',', i);
    if (close < 0) { text += src.slice(i); break; }
    if (comma < 0 || comma > close) {
      flush();
      nodes.push({ arg: src.slice(i + 1, close).trim() });
      i = close + 1;
      continue;
    }
    const arg = src.slice(i + 1, comma).trim();
    const second = src.indexOf(',', comma + 1);
    const kind = src.slice(comma + 1, second).trim();
    if (second < 0 || (kind !== 'plural' && kind !== 'select')) { text += c; i++; continue; }
    flush();
    const branches: Record<string, Node[]> = {};
    i = second + 1;
    for (;;) {
      while (/\s/.test(src[i] ?? '')) i++;
      if (src[i] === '}' || i >= src.length) { i++; break; }
      const open = src.indexOf('{', i);
      if (open < 0) { i = src.length; break; }
      const key = src.slice(i, open).trim();
      const inner = parse(src, open + 1, true, kind === 'plural' || inPlural);
      branches[key] = inner.nodes;
      i = inner.end + 1;
    }
    nodes.push({ arg, kind, branches });
  }
  flush();
  return { nodes, end: i };
}

function nodesOf(template: string): Node[] {
  let nodes = parsed.get(template);
  if (!nodes) {
    nodes = parse(template).nodes;
    if (parsed.size > 5000) parsed.clear();
    parsed.set(template, nodes);
  }
  return nodes;
}

const numbers = new Map<string, Intl.NumberFormat>();
const plurals = new Map<string, Intl.PluralRules>();
const numberFormat = (tag: string) => numbers.get(tag) ?? numbers.set(tag, new Intl.NumberFormat(tag)).get(tag)!;
const pluralRules = (tag: string) => plurals.get(tag) ?? plurals.set(tag, new Intl.PluralRules(tag)).get(tag)!;

function render(nodes: Node[], vars: Record<string, unknown>, tag: string, hash: number | null, out: unknown[]) {
  for (const node of nodes) {
    if (typeof node === 'string') out.push(node);
    else if ('hash' in node) out.push(hash === null ? '#' : numberFormat(tag).format(hash));
    else if (!('kind' in node)) {
      const v = vars[node.arg];
      out.push(v === undefined ? `{${node.arg}}` : typeof v === 'number' ? numberFormat(tag).format(v) : v);
    } else if (node.kind === 'plural') {
      const n = Number(vars[node.arg]);
      const branch = node.branches[`=${n}`] ?? node.branches[pluralRules(tag).select(n)] ?? node.branches.other ?? [];
      render(branch, vars, tag, n, out);
    } else {
      render(node.branches[String(vars[node.arg])] ?? node.branches.other ?? [], vars, tag, hash, out);
    }
  }
}

/** The message as pieces, so values that aren't text (React nodes) can be placed in it. Adjacent text is joined. */
export function formatParts(template: string, vars: Record<string, unknown>, tag: string): unknown[] {
  const raw: unknown[] = [];
  render(nodesOf(template), vars, tag, null, raw);
  const out: unknown[] = [];
  for (const piece of raw) {
    if (typeof piece === 'string' && typeof out[out.length - 1] === 'string') out[out.length - 1] += piece;
    else out.push(typeof piece === 'number' || typeof piece === 'boolean' ? String(piece) : piece);
  }
  return out;
}

export function formatMessage(template: string, vars: Record<string, unknown> | undefined, tag: string): string {
  if (!vars && !template.includes('{')) return template;
  return formatParts(template, vars ?? {}, tag).map(p => (p == null ? '' : String(p))).join('');
}

/** The variables a message reads, at any depth: a translation must read the same ones as its source. */
export function messageVariables(template: string): string[] {
  const names = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (typeof node === 'string' || 'hash' in node) continue;
      names.add(node.arg);
      if ('kind' in node) Object.values(node.branches).forEach(walk);
    }
  };
  walk(nodesOf(template));
  return [...names].sort();
}
