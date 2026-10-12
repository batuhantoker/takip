'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SIGN_IN_LINK, SETTINGS_CALLBACK } from '@/lib/account-links';
import { stopImpersonating } from '@/lib/impersonation';
import { TakipMark } from '@/components/brand/takip-mark';
import { TakipWordmark } from '@/components/brand/takip-wordmark';
import { onLocked } from './admin-api';
import { Button } from './admin-parts';
import UnlockForm from './unlock-form';

type GateStatus = { signedIn: boolean; admin: boolean; twoFactor: boolean; impersonating: boolean; unlockedUntil: number | null; retryAfterSeconds: number | null };

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/keys', label: 'API keys' },
  { href: '/admin/usage', label: 'Usage' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/sources', label: 'Sources' },
  { href: '/admin/audit', label: 'Audit log' },
];

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
    !status ? <p className="text-[12px] text-[var(--text-muted)]">Checking access…</p>
    : !status.signedIn ? <Message text="Sign in to continue." link={{ href: SIGN_IN_LINK, label: 'Sign in on the map' }} />
    : status.impersonating ? (
      <>
        <p className="text-[12px] text-[var(--text-muted)]">You&apos;re viewing the site as another user. Stop to get back to your own account and the console.</p>
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
    <div className="admin-root min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 flex items-center gap-6 px-6 h-12 border-b border-[var(--border-primary)] bg-[#070707]/95 backdrop-blur">
        <Link href="/admin" className="flex items-center gap-2 text-[var(--brand-ink)]">
          <TakipMark variant="small" className="h-5 w-auto" />
          <TakipWordmark className="h-[10px] w-auto" />
          <span className="text-[11px] font-mono tracking-[0.3em] text-[var(--text-muted)]">ADMIN</span>
        </Link>
        {!gate && (
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map(item => {
              const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2.5 py-1 text-[12px] whitespace-nowrap ${active ? 'text-[var(--text-primary)] bg-white/[0.07]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
          {status?.unlockedUntil && (
            <span className="hidden sm:inline">Locks at {new Date(status.unlockedUntil).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <Link href="/" className="hover:text-[var(--text-primary)]">Back to map</Link>
        </div>
      </header>
      {gate ? (
        <main className="max-w-sm mx-auto mt-24 px-4">
          <div className="border border-[var(--border-primary)] bg-[#0A0A0A] p-5 flex flex-col gap-3">
            <h1 className="text-sm">Admin console</h1>
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
      <p className="text-[12px] text-[var(--text-muted)]">{text}</p>
      <a href={link.href} className="text-[12px] text-[var(--gold-primary)] hover:underline">{link.label}</a>
    </>
  );
}
