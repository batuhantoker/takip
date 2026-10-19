'use client';

import { useState } from 'react';
import type { NewApiKey } from '@/lib/platform/account/api-keys';
import { Notice } from '@/components/site/account/form-parts';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';

/** The only time the full key is on screen: the api keeps just its hash. */
export default function NewApiKeyNotice({ created, onDone }: { created: NewApiKey; onDone: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // No clipboard API outside a secure context; the key stays selectable.
  const copy = () => void navigator.clipboard?.writeText(created.key).then(() => setCopied(true), () => {});

  return (
    <div className="flex flex-col gap-2">
      <Notice>
        {t("Here is your new key, “{name}”. Copy it now: it won't be shown again.", { name: created.name })}
      </Notice>
      <code className="p-2.5 rounded-card border border-line bg-surface-0 font-mono text-body text-ink-1 break-all select-all">{created.key}</code>
      <div className="flex items-center gap-2">
        <SmallButton onClick={copy}>{copied ? t('Copied') : t('Copy key')}</SmallButton>
        <SmallButton onClick={onDone}>{t("I've saved it")}</SmallButton>
      </div>
    </div>
  );
}
