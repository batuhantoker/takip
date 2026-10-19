'use client';
/** TAKIP TI: where a first visit adds its key, in place of the composer or the Run button. */
import { useState, type ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import { providerInfo } from '@/lib/ai/providers/catalog';
import { shortName } from '../theme';
import { KeyForm, KeyPrivacy, type EngineState } from './key-form';

export interface KeyCardControl {
  /** Whether the key entry is open; left out, the card keeps its own state. */
  adding?: boolean;
  onAdding?: (adding: boolean) => void;
  /** A question picked before there was a key: it waits in the box until one is added. */
  waiting?: string;
}

export function KeyCard({ note, adding: controlled, onAdding, waiting, ...p }: EngineState & KeyCardControl & { note?: ReactNode }) {
  const t = useT();
  const [own, setOwn] = useState(false);
  const adding = controlled ?? own;
  const setAdding = (v: boolean) => { setOwn(v); onAdding?.(v); };
  const name = shortName(providerInfo(p.engine.provider).name);
  if (adding) {
    return (
      <div className="flex w-full flex-col gap-3 py-1.5">
        {waiting && (
          <p className="text-small text-ink-2">
            {t.rich('Add a key and {question} is ready to send.', { question: <span className="text-ink-1">“{waiting}”</span> })}
          </p>
        )}
        <KeyForm {...p} autoFocus />
        <KeyPrivacy engine={p.engine} />
        <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={() => setAdding(false)}>{t('Not now')}</Button>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col items-start gap-3 py-1.5">
      <p className="text-small text-ink-2">
        {t('TI runs on your own {provider} key. It stays in this browser and is only used for your requests.', { provider: name })}{note ? <> {note}</> : null}
      </p>
      <Button variant="primary" size="sm" icon={KeyRound} onClick={() => setAdding(true)}>{t('Add key')}</Button>
    </div>
  );
}
