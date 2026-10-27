'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SIGN_IN_LINK, SETTINGS_CALLBACK } from '@/lib/platform/account/links';
import { stopImpersonating } from '@/lib/platform/account/impersonation';
import { TakipMark } from '@/components/shell/brand/takip-mark';
import { TakipWordmark } from '@/components/shell/brand/takip-wordmark';
import { onLocked } from './admin-api';
import { AREA_IDS, AREAS, areaOf } from './lib/areas';
import { Button } from '@/components/site/admin/parts/admin-parts';
import UnlockForm from '@/components/site/admin/parts/unlock-form';

type GateStatus = { signedIn: boolean; admin: boolean; twoFactor: boolean; impersonating: boolean; unlockedUntil: number | null; retryAfterSeconds: number | null };

export default function AdminShell({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus | null>(null);
  const pathname = usePathname();

  const check = useCallback(() => {
    void fetch('/api/admin/status', { cache: 'no-store' })
      .then(res => res.json() as Promise<GateStatus>)
      .then(setStatus)
      .catch(() => setStatus({ signedIn: false, admin: false, twoFactor: false, impersonating: false, unlockedUntil: null, retryAfterSeconds: null }));
  }, []);

  useEffect(() => {
    check();
    return onLocked(check);
  }, [check]);

  const gate =
    !status ? <p className="text-[12px] text-ink-3">Checking access…</p>
    : !status.signedIn ? <Message text="Sign in to continue." link={{ href: SIGN_IN_LINK, label: 'Sign in on the map' }} />
    : status.impersonating ? (
      <>
        <p className="text-[12px] text-ink-3">You&apos;re viewing the site as another user. Stop to get back to your own account and the console.</p>
        <Button tone="gold" className="self-start" onClick={() => void stopImpersonating()}>Stop viewing as them</Button>
      </>
    )
    : !status.admin ? <Message text="This area is for admins." link={{ href: '/', label: 'Back to the map' }} />
    : !status.twoFactor ? (
      <Message
        text="The admin console needs two-factor authentication. Turn it on in Account settings, then come back."
        link={{ href: SETTINGS_CALLBACK, label: 'Open Account settings' }}
      />
    )
    : !status.unlockedUntil ? <UnlockForm onUnlocked={check} retryAfterSeconds={status.retryAfterSeconds} />
    : null;

  return (
    <div className="admin-root min-h-screen bg-surface-0 text-ink-1">
      <header className="sticky top-0 z-10 flex items-center gap-6 px-6 h-12 border-b border-line bg-surface-1">
        <Link href="/admin" className="flex items-center gap-2 text-[var(--brand-ink)]">
          <TakipMark variant="small" className="h-5 w-auto" />
          <TakipWordmark className="h-[10px] w-auto" />
          <span className="text-[12px] font-medium text-ink-3">Admin</span>
        </Link>
        {!gate && (
          <nav className="flex items-center gap-1 overflow-x-auto">
            {AREA_IDS.map(id => {
              const item = AREAS[id];
              const active = areaOf(pathname) === id;
              return (
                <Link
                  key={id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-2.5 h-8 inline-flex items-center rounded-md text-[13px] whitespace-nowrap ${active ? 'text-ink-1 bg-surface-3' : 'text-ink-2 hover:text-ink-1 hover:bg-surface-2'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-4 text-[11px] text-ink-3">
          {status?.unlockedUntil && (
            <span className="hidden sm:inline">Locks at {new Date(status.unlockedUntil).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <Link href="/" className="hover:text-ink-1">Back to map</Link>
        </div>
      </header>
      {gate ? (
        <main className="max-w-sm mx-auto mt-24 px-4">
          <div className="rounded-float border border-line bg-surface-1 shadow-float p-5 flex flex-col gap-3">
            <h1 className="text-[15px] font-semibold">Admin console</h1>
            {gate}
          </div>
        </main>
      ) : (
        <main className="max-w-6xl mx-auto px-6 py-6">{children}</main>
      )}
    </div>
  );
}

function Message({ text, link }: { text: string; link: { href: string; label: string } }) {
  return (
    <>
      <p className="text-[12px] text-ink-3">{text}</p>
      <a href={link.href} className="text-[13px] text-accent hover:underline">{link.label}</a>
    </>
  );
}
