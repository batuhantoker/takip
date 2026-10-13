export const MENU_TRIGGER =
  'glass-panel flex items-center gap-1.5 text-[9px] font-mono tracking-widest hover:opacity-80 transition-opacity border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10';

export const MENU_PANEL =
  'absolute right-0 top-full mt-2 z-[1000] w-60 bg-[#0A0A0A]/95 backdrop-blur-md border border-[var(--gold-primary)]/25 shadow-2xl p-1';

export const MENU_ITEM =
  'w-full text-left flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/5 focus:bg-white/5 focus:outline-none transition-colors';

/** A menu opened from the sidebar: beside it, growing up from the trigger. Opaque: a backdrop blur nested in the sidebar's own blur lets the panel behind show through. */
export const MENU_PANEL_SIDE =
  'absolute left-full bottom-0 ml-3 z-[1000] w-60 bg-[var(--bg-panel-solid)] border border-[var(--gold-primary)]/25 shadow-2xl p-1';

export const RAIL_TRIGGER =
  'w-full flex flex-col items-center gap-1 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40';
