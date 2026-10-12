'use client';

import { useEffect, useState } from 'react';
import { Heart, X } from 'lucide-react';
import { ADBLOCK_SNOOZE_KEY, ADBLOCK_SNOOZE_MS, adblockSnoozed } from '@/lib/ads';

/** Long enough for the splash and a first look around. */
const DELAY_MS = 20_000;

function readSnooze(): string | null {
  try {
    return localStorage.getItem(ADBLOCK_SNOOZE_KEY);
  } catch {
    return null;
  }
}

function snooze() {
  try {
    localStorage.setItem(ADBLOCK_SNOOZE_KEY, String(Date.now() + ADBLOCK_SNOOZE_MS));
  } catch {}
}

/** A friendly ask, at most once a day; nothing is held back if they say no. */
export default function AdblockNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setOpen(!adblockSnoozed(readSnooze(), Date.now())), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!open) return null;
  const dismiss = () => {
    snooze();
    setOpen(false);
  };

  return (
    <div role="dialog" aria-labelledby="adblock-title"
      className="glass-panel fixed bottom-10 right-16 z-[900] w-[min(420px,calc(100vw-88px))] p-4">
      <div className="flex items-start gap-3">
        <Heart className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-light)]" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="adblock-title" className="text-[13px] font-semibold text-[var(--text-heading)]">A small favour, if you don&apos;t mind</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            Fair enough, ad blockers make most of the web nicer. TAKIP is free thanks to a few quiet ads, kept well away
            from the map. If you&apos;d like to help keep it that way, you could let them through here.
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">Most blockers have a &ldquo;pause on this site&rdquo; option in their menu. Everything works either way, and thanks for being here.</p>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => { snooze(); location.reload(); }}
              className="rounded-md bg-[var(--gold-primary)]/15 border border-[var(--gold-primary)]/40 px-3 py-1.5 text-[12px] font-semibold text-[var(--gold-light)] hover:bg-[var(--gold-primary)]/25">
              Done, reload
            </button>
            <button type="button" onClick={dismiss}
              className="rounded-md px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]">
              Maybe later
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss"
          className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-heading)]">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
