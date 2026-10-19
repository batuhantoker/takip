'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye } from 'lucide-react';
import { authClient } from '@/components/site/account/auth-client';
import { stopImpersonating } from '@/lib/platform/account/impersonation';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';

/** Shown on top of everything while an admin views the site as someone else. Portalled, so no panel's opacity or stacking hides it. */
export default function ImpersonationBanner() {
  const t = useT();
  const { data } = authClient.useSession();
  const [stopping, setStopping] = useState(false);
  if (!data?.session.impersonatedBy || typeof document === 'undefined') return null;
  const ends = new Date(data.session.expiresAt).toLocaleTimeString(t.intl, { hour: '2-digit', minute: '2-digit' });

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[10050] flex justify-center px-2 pointer-events-none" style={{ paddingTop: 'max(4px, env(safe-area-inset-top))' }}>
      <div role="status" className="pointer-events-auto flex max-w-full items-center gap-2 rounded-float border border-red/50 bg-surface-1 py-1.5 pr-1.5 pl-3 text-small text-ink-2 shadow-float">
        <Eye className="size-4 shrink-0 text-red" strokeWidth={1.75} aria-hidden />
        <span className="truncate">
          {t.rich('Viewing as {name}', { name: <strong className="font-semibold text-ink-1">{data.user.name || data.user.email}</strong> })}
          <span className="hidden text-ink-3 sm:inline"> · {t('ends {time}', { time: ends })}</span>
        </span>
        <Button variant="danger" size="sm" loading={stopping} onClick={() => { setStopping(true); void stopImpersonating(); }}>
          {t('Stop')}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
