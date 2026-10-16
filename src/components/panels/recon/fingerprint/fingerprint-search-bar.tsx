'use client';

import { AtSign, Mail, Phone, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { SearchField } from '@/components/ui/search-field';
import type { SearchType } from '@/lib/intel/recon/fingerprint/search';
import { SIGN_IN_REQUIRED } from '@/lib/intel/recon/lookup';
import type { FingerprintState } from './use-fingerprint-search';
import { SignInNotice } from '@/components/panels/recon/parts/sign-in-notice';
import { ErrorNote } from '@/components/panels/recon/parts/error-note';

const MODES: { id: SearchType; label: string; icon: typeof AtSign; placeholder: string; covers: string }[] = [
  { id: 'username', label: 'Username', icon: AtSign, placeholder: 'Enter a username', covers: 'every public site in the Sherlock list, then reads the profiles it finds to tell which are the same person' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'Enter an email address', covers: 'its mail provider, Gravatar, GitHub, PGP keys, known breaches and infostealer logs' },
  { id: 'phone', label: 'Phone', icon: Phone, placeholder: 'Enter a phone number, like +1…', covers: 'the numbering plan for validity, region and line type, and infostealer logs' },
];

export function FingerprintSearchBar({ fp, running, autoFocus }: { fp: FingerprintState; running: boolean; autoFocus?: boolean }) {
  const mode = MODES.find(m => m.id === fp.mode) ?? MODES[0];
  const submit = () => { if (running) fp.stop(); else fp.run(fp.mode, fp.query); };

  return (
    <div className="flex flex-col gap-2.5">
      <Segmented size="sm" full label="Search type" value={fp.mode}
        onChange={v => { if (!running) { fp.setMode(v); fp.setError(''); } }}
        options={MODES.map(m => ({ value: m.id, label: m.label, icon: m.icon, disabled: running }))} />

      <div className="flex gap-2">
        <SearchField className="flex-1" value={fp.query} onChange={fp.setQuery}
          onKeyDown={e => { if (e.key === 'Enter' && !running && fp.query.trim()) submit(); }}
          placeholder={mode.placeholder} label={mode.placeholder} disabled={running} autoFocus={autoFocus} autoComplete="off" spellCheck={false}
          inputMode={fp.mode === 'phone' ? 'tel' : fp.mode === 'email' ? 'email' : 'text'} />
        {running
          ? <Button variant="danger" icon={Square} onClick={submit}>Stop</Button>
          : <Button variant="primary" disabled={!fp.query.trim()} onClick={submit}>Search</Button>}
      </div>

      <p className="text-meta text-ink-3">Public sources only. Checks {mode.covers}.</p>

      {fp.error === SIGN_IN_REQUIRED ? <SignInNotice />
        : fp.error ? <ErrorNote message={fp.error} onDismiss={() => fp.setError('')} /> : null}
    </div>
  );
}
