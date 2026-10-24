'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { HowTo } from '@/components/shell/tour/how-to';
import { askForAccount, useSignedIn } from '@/components/site/account/plan-gate';
import { msg } from '@/lib/core/i18n/translator';
import { TiGlyph } from '../atoms';

const REASON = { visitor: msg('Create a free account to use TI.'), member: msg("TI isn't in your plan.") };

/** In place of TI for a plan without `ai.assistant`; opening it asks once, the button asks again. */
export default function TiAccountPrompt({ embedded, onClose }: { embedded: boolean; onClose?: () => void }) {
  const t = useT();
  const signedIn = useSignedIn();
  // Once per opening: signing up flips signedIn before the new plan lifts this prompt.
  const asked = useRef(false);
  const reason = { visitor: t(REASON.visitor), member: t(REASON.member) };
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    askForAccount({ visitor: t(REASON.visitor), member: t(REASON.member) }, signedIn);
  }, [signedIn, t]);
  const prompt = (
    <EmptyState icon={TiGlyph}
      title={signedIn ? t("TI isn't in your plan") : t('TI needs a free account')}
      body={signedIn ? t('See which plans include it in Account settings.') : t('Ask TI to work the map, find what is live and forecast what happens next.')}
      action={<Button variant="primary" onClick={() => askForAccount(reason, signedIn)}>{signedIn ? t('See plans') : t('Create account')}</Button>} />
  );
  return embedded ? prompt : <Panel title="TI" subtitle="Takip AI" icon={TiGlyph} onClose={onClose}>{prompt}<HowTo /></Panel>;
}
