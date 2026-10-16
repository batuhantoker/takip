/**
 * One definition per tool, read by both surfaces: TI's prompt shows a signature line and the prose,
 * MCP lists a JSON schema built from the same parameters. After God's Eye View's
 * defineTool / composeCatalog / TOOL_SURFACES (src/tools/, MIT).
 */

export type Surface = 'ti' | 'mcp';

export interface Param {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'place' | 'object' | 'array';
  about: string;
  required?: boolean;
  enum?: readonly string[];
  items?: Param;
  props?: Record<string, Param>;
  min?: number;
  max?: number;
}

export interface ToolDef {
  name: string;
  /** The MCP tool's name, when it is not `takip_<name>`. */
  mcpName?: string;
  title: string;
  /** What it does, for both surfaces. */
  about: string;
  /** More for TI only: how to use it while working the map. */
  ti?: string;
  /** More for MCP only. */
  mcp?: string;
  params: Record<string, Param>;
  surfaces: Surface[];
  readOnly?: boolean;
}

export const place = (about: string, required = false): Param => ({ type: 'place', about, required });

function typeWords(p: Param): string {
  // A long list is spelled out in the prose instead.
  if (p.enum) return p.enum.length > 6 ? 'string' : p.enum.map(v => `"${v}"`).join('|');
  if (p.type === 'place') return 'string | {lat, lng}';
  if (p.type === 'integer') return p.min !== undefined && p.max !== undefined ? `${p.min}-${p.max}` : 'number';
  if (p.type === 'array') return p.items?.type === 'object' && p.items.props ? `[{${Object.keys(p.items.props).join(', ')}}]` : `${p.items ? typeWords(p.items) : 'string'}[]`;
  if (p.type === 'object' && p.props) return `{${Object.keys(p.props).join(', ')}}`;
  return p.type;
}

/** `find {layer, text?, near?: string | {lat, lng}}`, as TI's prompt shows it. */
export function signature(d: ToolDef): string {
  const args = Object.entries(d.params).map(([k, p]) => (p.required ? (p.type === 'string' && !p.enum ? k : `${k}: ${typeWords(p)}`) : `${k}?: ${typeWords(p)}`));
  return `${d.name} {${args.join(', ')}}`;
}

export function guideEntry(d: ToolDef): string {
  return `${signature(d)}\n  ${[d.about, d.ti].filter(Boolean).join(' ')}`;
}

function schemaOf(p: Param): Record<string, unknown> {
  const base: Record<string, unknown> = { description: p.about };
  if (p.type === 'place') {
    return { ...base, anyOf: [{ type: 'string' }, { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } }, required: ['lat', 'lng'] }] };
  }
  if (p.enum) return { ...base, type: 'string', enum: [...p.enum] };
  if (p.type === 'array') return { ...base, type: 'array', items: p.items ? schemaOf(p.items) : { type: 'string' } };
  if (p.type === 'object') return { ...base, ...objectSchema(p.props ?? {}) };
  return { ...base, type: p.type, ...(p.min !== undefined ? { minimum: p.min } : {}), ...(p.max !== undefined ? { maximum: p.max } : {}) };
}

export function objectSchema(params: Record<string, Param>): Record<string, unknown> {
  const required = Object.entries(params).filter(([, p]) => p.required).map(([k]) => k);
  return {
    type: 'object',
    properties: Object.fromEntries(Object.entries(params).map(([k, p]) => [k, schemaOf(p)])),
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}

export const mcpNameOf = (d: ToolDef) => d.mcpName ?? `takip_${d.name}`;

/** The tool as MCP's tools/list shows it. */
export function mcpTool(d: ToolDef) {
  return {
    name: mcpNameOf(d),
    title: d.title,
    description: [d.about, d.mcp].filter(Boolean).join(' '),
    inputSchema: objectSchema(d.params),
    annotations: { readOnlyHint: d.readOnly ?? true, openWorldHint: true },
  };
}
