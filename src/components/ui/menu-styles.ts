// Class strings for menus built before Popover and MenuItem; new menus use those.

export const MENU_TRIGGER =
  'flex items-center gap-1.5 rounded-control border border-line bg-surface-1 text-meta font-medium text-ink-2 hover:bg-surface-2 hover:text-ink-1 transition-colors';

export const MENU_PANEL =
  'absolute right-0 top-full mt-2 z-[1000] w-60 rounded-float border border-line bg-surface-1 shadow-float p-1';

export const MENU_ITEM =
  'w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink-1 focus:bg-surface-2 focus:outline-none transition-colors';

/** A menu opened from the sidebar: beside it, growing up from the trigger. */
export const MENU_PANEL_SIDE =
  'absolute left-full bottom-0 ml-3 z-[1000] w-60 rounded-float border border-line bg-surface-1 shadow-float p-1';

export const RAIL_TRIGGER =
  'w-full flex flex-col items-center gap-1 py-2 rounded-card text-ink-2 hover:bg-surface-2 hover:text-ink-1 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
