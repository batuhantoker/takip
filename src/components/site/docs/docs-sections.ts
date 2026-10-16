import { API_GROUPS } from './api-catalog';

export const GUIDE_SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'quickstart', title: 'Quick start' },
  { id: 'self-hosting', title: 'Self-hosting' },
  { id: 'configuration', title: 'Configuration' },
  { id: 'interface', title: 'Interface guide' },
  { id: 'ti', title: 'TI & MCP' },
  { id: 'shortcuts', title: 'Keyboard shortcuts' },
];

export const API_SECTIONS = [
  { id: 'api', title: 'Conventions' },
  ...API_GROUPS.map(g => ({ id: `api-${g.id}`, title: g.title })),
];

export const ALL_SECTIONS = [...GUIDE_SECTIONS, ...API_SECTIONS];
