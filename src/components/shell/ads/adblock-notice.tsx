'use client';

import { useEffect, useState } from 'react';
import { Heart, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, ENTER } from '@/components/ui/class-names';
import { ADBLOCK_SNOOZE_KEY, ADBLOCK_SNOOZE_MS, adblockSnoozed } from '@/lib/platform/ads';

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
    <div role="dialog" aria-labelledby="adblock-title" data-hud
      className={cx('fixed right-[var(--beside-controls,62px)] bottom-[calc(var(--shell-bottom,var(--shell-foot,28px))+12px)] z-[900] w-[min(380px,calc(100vw-88px))] rounded-float border border-line bg-surface-1 p-4 shadow-float max-md:right-3 max-md:bottom-[calc(var(--shell-bottom,56px)+12px+env(safe-area-inset-bottom))]', ENTER, 'starting:translate-y-1')}>
      <div className="flex items-start gap-3">
        <Heart className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="adblock-title" className="text-body font-semibold text-ink-1">A small favour, if you don&apos;t mind</h2>
          <p className="mt-1 text-small text-ink-2">
            Fair enough, ad blockers make most of the web nicer. TAKIP is free thanks to a few quiet ads, kept well away
            from the map. If you&apos;d like to help keep it that way, you could let them through here.
          </p>
          <p className="mt-1.5 text-meta text-ink-3">Most blockers have a &ldquo;pause on this site&rdquo; option in their menu. Everything works either way, and thanks for being here.</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={() => { snooze(); location.reload(); }}>Done, reload</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Maybe later</Button>
          </div>
        </div>
        <IconButton label="Dismiss" icon={X} size="sm" onClick={dismiss} className="-mt-1 -mr-1" />
      </div>
    </div>
  );
}
