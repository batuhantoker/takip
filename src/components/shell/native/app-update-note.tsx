'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, ENTER } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { appShell } from '@/lib/platform/native/shell';

const DISMISSED_KEY = 'takip.app.updateDismissed';
/** After the splash, so it isn't the first thing on screen. */
const DELAY_MS = 15_000;

function dismissed(version: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === version;
  } catch {
    return false;
  }
}

/** Tells an app older than the newest build on /download (layout.tsx decides); once per version. */
export default function AppUpdateNote({ version }: { version: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setOpen(!dismissed(version)), DELAY_MS);
    return () => clearTimeout(timer);
  }, [version]);

  if (!open) return null;
  const later = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, version);
    } catch {}
    setOpen(false);
  };
  // In the system browser, where the file downloads as it should.
  const get = async () => {
    const shell = appShell(navigator.userAgent);
    if (shell) await (await import('@/lib/platform/native/bridge')).openSystemBrowser(shell, `${location.origin}/download#${shell.platform}`);
    later();
  };

  return (
    <div role="dialog" aria-labelledby="app-update-title" data-hud
      className={cx('fixed right-[var(--beside-controls,62px)] bottom-[calc(var(--shell-bottom,var(--shell-foot,28px))+12px)] z-[900] w-[min(360px,calc(100vw-88px))] rounded-float border border-line bg-surface-1 p-4 shadow-float max-md:right-3 max-md:bottom-[calc(var(--shell-bottom,56px)+12px+env(safe-area-inset-bottom))]', ENTER, 'starting:translate-y-1')}>
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="app-update-title" className="text-body font-semibold text-ink-1">{t('TAKIP {version} is out', { version })}</h2>
          <p className="mt-1 text-small text-ink-2">{t('The map is always up to date; this updates the app around it.')}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => void get()}>{t('Get it')}</Button>
            <Button size="sm" variant="ghost" onClick={later}>{t('Later')}</Button>
          </div>
        </div>
        <IconButton label={t('Dismiss')} icon={X} size="sm" onClick={later} className="-mt-1 -mr-1" />
      </div>
    </div>
  );
}
