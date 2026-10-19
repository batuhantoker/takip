import { API_GROUPS } from './api-catalog';
import { msg } from '@/lib/core/i18n/translator';

export const GUIDE_SECTIONS = [
  { id: 'overview', title: msg('Overview') },
  { id: 'quickstart', title: msg('Quick start') },
  { id: 'self-hosting', title: msg('Self-hosting') },
  { id: 'configuration', title: msg('Configuration') },
  { id: 'interface', title: msg('Interface guide') },
  { id: 'ti', title: msg('TI & MCP') },
  { id: 'shortcuts', title: msg('Keyboard shortcuts') },
];

export const API_SECTIONS = [
  { id: 'api', title: msg('Conventions') },
  ...API_GROUPS.map(g => ({ id: `api-${g.id}`, title: g.title })),
];

export const ALL_SECTIONS = [...GUIDE_SECTIONS, ...API_SECTIONS];
