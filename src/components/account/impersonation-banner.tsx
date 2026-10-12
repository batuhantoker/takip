'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { stopImpersonating } from '@/lib/impersonation';

/** Shown on top of everything while an admin views the site as someone else. Portalled, so no panel's opacity or stacking hides it. */
export default function ImpersonationBanner() {
  const { data } = authClient.useSession();
  const [stopping, setStopping] = useState(false);
  if (!data?.session.impersonatedBy || typeof document === 'undefined') return null;
  const ends = new Date(data.session.expiresAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

  return createPortal(
    <div className="fixed inset-x-0 top-0 z-[10050] flex justify-center px-2 pointer-events-none" style={{ paddingTop: 'max(4px, env(safe-area-inset-top))' }}>
      <div role="status" className="pointer-events-auto flex items-center gap-2 max-w-full px-3 py-1.5 bg-[#2a0707]/95 border border-[var(--alert-red)]/70 shadow-2xl text-[11px] text-white">
        <Eye className="w-3.5 h-3.5 shrink-0 text-[var(--alert-red)]" aria-hidden />
        <span className="truncate">
          Viewing as <strong className="font-semibold">{data.user.name || data.user.email}</strong>
          <span className="hidden sm:inline text-white/60"> · ends {ends}</span>
        </span>
        <span aria-hidden className="text-white/40">·</span>
        <button
          type="button"
          disabled={stopping}
          onClick={() => {
            setStopping(true);
            void stopImpersonating();
          }}
          className="shrink-0 font-semibold text-[var(--alert-red)] hover:underline disabled:opacity-50"
        >
          {stopping ? 'Stopping…' : 'Stop'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
