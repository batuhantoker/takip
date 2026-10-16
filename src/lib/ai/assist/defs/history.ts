/** The tools that read TAKIP's historical record: what happened at a place over a period, and one event in depth. */
import { HISTORY_FAMILIES } from '@/lib/history/popup';
import { place, type ToolDef } from './define';

const FAMILIES = Object.keys(HISTORY_FAMILIES);

export const HISTORY_DEFS = {
  chronicle: {
    name: 'chronicle', title: 'What happened here, then', surfaces: ['ti', 'mcp'],
    about: `What TAKIP's historical record holds for a place over a period: wars, battles, massacres, attacks, coups, revolutions, treaties, territorial changes, disasters, earthquakes, nuclear tests and heritage in danger. from and to are years ("1914", "500 BC"), a decade ("1990s") or dates; to defaults to the end of from. Without place it reads the whole world. It returns the most significant events of each family, oldest first, each with an id for past_event, and how many there are in all per family; a family too dense to list comes back as a count only. Families: ${FAMILIES.join(', ')}.`,
    ti: 'For a story about a place or a period: chronicle first, timeline {mode: "history", at} to put the map in that year, then past_event on the few events that carry the story. Tell it oldest first, name the events, and give only the dates and figures the RESULTS give; where the record is thin, say so. show (default true) marks the events on the map.',
    params: {
      place: place('Where: a country, region, sea or city, or a point. Leave it out for the whole world.'),
      radius_km: { type: 'number', about: 'How far round place to look; by default it follows the kind of place (a country reaches further than a city).' },
      from: { type: 'string', about: 'Start: a year ("1914", "500 BC"), a decade ("1990s") or a date.', required: true },
      to: { type: 'string', about: 'End, inclusive; default the end of from.' },
      families: { type: 'array', items: { type: 'string', enum: FAMILIES, about: 'A family.' }, about: 'Only these kinds of event.' },
      limit: { type: 'integer', min: 1, max: 25, about: 'Events to list, default 20.' },
      show: { type: 'boolean', about: 'Mark them on the map (TI only, default true).' },
    },
  },
  past_event: {
    name: 'past_event', title: 'One event from the historical record', surfaces: ['ti', 'mcp'],
    about: 'One event from TAKIP\'s historical record (an id from chronicle; not an event of a forecast) in depth: its dates at the precision they are known, what kind of event it was, who fought or took part, the casualties or size its source gives, the war it was part of and the events it includes, where it is placed and how exactly, the source, and its Wikipedia article.',
    ti: 'show (default true) marks it on the map and flies there.',
    params: {
      id: { type: 'integer', about: 'The event\'s id, from chronicle.', required: true },
      show: { type: 'boolean', about: 'Mark it and fly there (TI only, default true).' },
    },
  },
} satisfies Record<string, ToolDef>;
