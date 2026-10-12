'use client';

import { useState } from 'react';
import type { NewApiKey } from '@/lib/api-keys';
import { Notice } from '../form-parts';
import { SmallButton } from './settings-parts';

/** The only time the full key is on screen: the api keeps just its hash. */
export default function NewApiKeyNotice({ created, onDone }: { created: NewApiKey; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  // No clipboard API outside a secure context; the key stays selectable.
  const copy = () => void navigator.clipboard?.writeText(created.key).then(() => setCopied(true), () => {});

  return (
    <div className="flex flex-col gap-2">
      <Notice>
        Here is your new key, &ldquo;{created.name}&rdquo;. Copy it now: it won&apos;t be shown again.
      </Notice>
      <code className="p-2.5 border border-white/10 bg-black/40 font-mono text-[11px] text-[var(--text-primary)] break-all select-all">{created.key}</code>
      <div className="flex items-center gap-2">
        <SmallButton onClick={copy}>{copied ? 'Copied' : 'Copy key'}</SmallButton>
        <SmallButton onClick={onDone}>I&apos;ve saved it</SmallButton>
      </div>
    </div>
  );
}
