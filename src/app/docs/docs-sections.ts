import { API_GROUPS } from './apiCatalog';

export const GUIDE_SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'quickstart', title: 'Quick Start' },
  { id: 'self-hosting', title: 'Self-Hosting' },
  { id: 'configuration', title: 'Configuration' },
  { id: 'interface', title: 'Interface Guide' },
  { id: 'oi', title: 'TI & MCP' },
  { id: 'shortcuts', title: 'Keyboard Shortcuts' },
];

export const API_SECTIONS = [
  { id: 'api', title: 'Conventions' },
  ...API_GROUPS.map(g => ({ id: `api-${g.id}`, title: g.title })),
];

export const ALL_SECTIONS = [...GUIDE_SECTIONS, ...API_SECTIONS];
