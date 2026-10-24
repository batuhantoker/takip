import type { ToolId } from '@/components/shell/sidebar/dock';
import type { Align, Side } from '@/components/ui/position';
import { msg } from '@/lib/core/i18n/translator';

export type StopId = 'layout' | 'basemap' | 'layers' | 'history' | 'space' | 'recon' | 'ai';

export type Stop = {
  id: StopId;
  title: string;
  body: string;
  /** One line for TI's How to list. */
  hint: string;
  /** What to ring, as `data-tour` and other selectors. The card sits beside the first one on screen. */
  targets: string[];
  /** Where the card goes from that target; without one it sits in the middle. */
  side?: Side;
  align?: Align;
  kbd?: string;
  /** The panel the stop is about: kept open if it already was, so its own How this works rings it. */
  tool?: ToolId;
  /** Opened for the stop even when it was closed; only panels that don't change the map. */
  opens?: boolean;
};

/** The tour, in the order it plays. The targets are `data-tour` marks on the shell's own pieces. */
export const STOPS: Stop[] = [
  {
    id: 'layout',
    title: msg('Make the layout yours'),
    body: msg('Every piece ringed here can be hidden, reordered or moved to another corner in Settings → Layout, under More. Arrange there lets you drag them anywhere on the map.'),
    hint: msg('Hide, reorder and move what is on screen'),
    targets: ['[data-tour="more"]', '[data-corner] > *', '[data-free] > *'],
  },
  {
    id: 'basemap',
    title: msg('Base map and looks'),
    body: msg('Dark, Satellite or Topo, and under them how the map is drawn: day and night, 3D buildings and terrain, the theme, and the Style studio for your own colours and type.'),
    hint: msg('Satellite, topo, 3D and the Style studio'),
    targets: ['[role="dialog"]:has([data-tour="basemap-menu"])', '[data-tour="basemap"]'],
    side: 'left',
  },
  {
    id: 'layers',
    title: msg('Layers'),
    body: msg('Choose what the map shows: aircraft, ships, satellites, cameras, weather, quakes and more. Switch on as many as you like; they share one map.'),
    hint: msg('Choose what the map shows'),
    targets: ['[data-tour="dock"][data-tool="layers"]', '[data-tour="layers"]'],
    side: 'right',
    kbd: 'L',
    tool: 'layers',
    opens: true,
  },
  {
    id: 'history',
    title: msg('History'),
    body: msg('The past on a timeline: borders as they were, wars, battles and other events, countries coloured by the numbers, and the drifting continents of deep time.'),
    hint: msg('The past on a timeline'),
    targets: ['[data-tour="dock"][data-tool="history"]', '[data-tour="history"]'],
    side: 'right',
    kbd: 'H',
    tool: 'history',
  },
  {
    id: 'space',
    title: msg('Space'),
    body: msg('Leave Earth from Map | Space, or keep zooming out past the globe: the Moon, the planets and the stars, each where it is right now. The Space panel follows spacecraft and the ISS.'),
    hint: msg('The Moon, planets and spacecraft, live'),
    targets: ['[data-tour="dock"][data-tool="space"]', '[data-tour="switcher"]', '[data-tour="space"]'],
    side: 'top',
    align: 'start',
    tool: 'space',
  },
  {
    id: 'recon',
    title: msg('Recon'),
    body: msg('Look up an IP address, domain, username or phone number and see what is public about it, placed on the map where it can be.'),
    hint: msg('Look up an IP, domain, username or phone'),
    targets: ['[data-tour="dock"][data-tool="recon"]', '[data-tour="recon"]'],
    side: 'right',
    kbd: 'I',
    tool: 'recon',
    opens: true,
  },
  {
    id: 'ai',
    title: msg('Ask TI'),
    body: msg('TI works the map for you: it flies there, switches on the right layers and marks what it finds. This tour stays in TI, under How to use TAKIP.'),
    hint: msg('Ask, and TI works the map'),
    targets: ['[data-tour="ai"]'],
    side: 'right',
    kbd: 'T',
  },
];
