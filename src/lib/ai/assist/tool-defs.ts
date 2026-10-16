/**
 * TAKIP AI Assist: every tool, defined once. TI's prompt and the MCP server's tools/list both come
 * from these definitions; ./tools runs them in the page and ./serve on the server.
 */
import { DATA_DEFS } from './defs/data';
import { mcpNameOf, guideEntry, type ToolDef } from './defs/define';
import { FORECAST_DEFS } from './defs/forecast';
import { HISTORY_DEFS } from './defs/history';
import { MAP_DEFS } from './defs/map';

/** In the order TI's prompt lists them. */
export const TOOL_NAMES = [
  'go_to', 'move', 'layers', 'find', 'scan', 'track', 'untrack', 'aircraft', 'weather', 'pass', 'brief', 'route', 'nearby',
  'camera', 'highlight', 'show', 'markets', 'open', 'map_view', 'timeline', 'chronicle', 'past_event', 'link', 'forecast', 'workspace', 'select', 'clear',
] as const;
export type ToolName = typeof TOOL_NAMES[number];

export const TOOL_DEFS: Record<ToolName, ToolDef> = { ...MAP_DEFS, ...DATA_DEFS, ...HISTORY_DEFS, ...FORECAST_DEFS };

export function toolGuide(): string {
  return `TOOLS (each action is {"tool": name, "args": {…}}):\n\n${TOOL_NAMES.filter(n => TOOL_DEFS[n].surfaces.includes('ti')).map(n => guideEntry(TOOL_DEFS[n])).join('\n\n')}`;
}

/** The tools the MCP server runs itself, by their MCP names. */
export const MCP_DEFS: ToolDef[] = TOOL_NAMES.map(n => TOOL_DEFS[n]).filter(d => d.surfaces.includes('mcp'));

export function defByMcpName(name: string): ToolDef | null {
  return MCP_DEFS.find(d => mcpNameOf(d) === name) ?? null;
}
