'use client';
/**
 * TAKIP TI: the reader's own key. Which provider, the key itself, whether
 * this device remembers it, and a check that it works (which also lists the
 * models it can use).
 */
import { useState } from 'react';
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Select, Switch, TextField } from '@/components/ui/field';
import { PROVIDERS, providerInfo, type ProviderId } from '@/lib/oi/providers';
import { checkKey, forgetKey, loadKey, saveEngine, saveKey, type Engine } from '@/lib/oi/client';
import { shortName } from '../theme';

export type ModelList = { models: { id: string; name: string }[]; listed: boolean };

export interface EngineState {
  engine: Engine;
  setEngine: (e: Engine) => void;
  keyValue: string;
  setKey: (k: string) => void;
}

type Status = { kind: 'idle' | 'checking' | 'ok' | 'error'; text: string };

export function KeyForm({ engine, setEngine, keyValue, setKey, onModels, onSaved, autoFocus }: EngineState & {
  /** The models the key can use, once checked. */
  onModels?: (list: ModelList | null) => void;
  /** The key was saved and works. */
  onSaved?: () => void;
  autoFocus?: boolean;
}) {
  const info = providerInfo(engine.provider);
  const [draft, setDraft] = useState(keyValue);
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });
  const update = (next: Engine) => { setEngine(next); saveEngine(next); };

  const pickProvider = (id: ProviderId) => {
    update({ ...engine, provider: id, model: providerInfo(id).defaultModel });
    const saved = loadKey(id);
    setKey(saved);
    setDraft(saved);
    onModels?.(null);
    setStatus({ kind: 'idle', text: '' });
  };

  const save = async () => {
    const k = draft.trim();
    if (!k) return;
    setStatus({ kind: 'checking', text: '' });
    const out = await checkKey(engine.provider, k);
    if ('error' in out) { setStatus({ kind: 'error', text: out.error }); return; }
    // Only a key that works replaces the one in use.
    saveKey(engine.provider, k, engine.remember);
    setKey(k);
    onModels?.({ models: out.models, listed: out.listed });
    const model = out.models.some(m => m.id === engine.model) ? engine.model : out.preferred || engine.model;
    update({ ...engine, model });
    setStatus({ kind: 'ok', text: `Key works · ${out.models.length} model${out.models.length === 1 ? '' : 's'} available` });
    setTimeout(() => setStatus(st => (st.kind === 'ok' ? { kind: 'idle', text: '' } : st)), 4000);
    onSaved?.();
  };

  const forget = () => {
    forgetKey(engine.provider);
    setKey('');
    setDraft('');
    onModels?.(null);
    setStatus({ kind: 'idle', text: '' });
  };

  const changed = draft.trim() !== keyValue;

  return (
    <div className="flex flex-col gap-3">
      <Select label="Provider" size="sm" value={engine.provider} onChange={e => pickProvider(e.target.value as ProviderId)}
        options={PROVIDERS.map(p => ({ value: p.id, label: shortName(p.name) }))} />

      {info.needsKey ? (
        <>
          <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); void save(); }}>
            <TextField label={`${shortName(info.name)} key`} size="sm" className="min-w-0 flex-1"
              type={reveal ? 'text' : 'password'} value={draft} autoFocus={autoFocus}
              onChange={e => { setDraft(e.target.value.trim()); setStatus({ kind: 'idle', text: '' }); }}
              placeholder={info.keyHint} autoComplete="off" spellCheck={false} data-1p-ignore data-lpignore="true"
              trailing={<IconButton size="sm" className="-mr-1.5" label={reveal ? 'Hide key' : 'Show key'} icon={reveal ? EyeOff : Eye} onClick={() => setReveal(v => !v)} />} />
            <Button type="submit" size="sm" variant={changed ? 'primary' : 'secondary'} disabled={!draft} loading={status.kind === 'checking'}>
              {changed || !keyValue ? 'Save' : 'Check'}
            </Button>
          </form>
          {/* One line under the field: how the check went, else the way to get a key or to drop the saved one. */}
          {status.text ? (
            <p role="status" className={cx('-mt-1.5 text-meta', status.kind === 'error' ? 'text-red' : 'text-green')}>{status.text}</p>
          ) : keyValue ? (
            <button type="button" onClick={forget} className={cx('-mt-1.5 self-start rounded-control text-meta text-ink-3 hover:text-red', FOCUS_RING)}>Forget this key</button>
          ) : info.keyUrl ? (
            <a href={info.keyUrl} target="_blank" rel="noopener noreferrer" className={cx('-mt-1.5 inline-flex items-center gap-0.5 self-start rounded-control text-meta text-accent hover:underline', FOCUS_RING)}>
              Get a key from {shortName(info.name)}<ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
            </a>
          ) : null}
          <Switch size="sm" label="Remember on this device" checked={engine.remember} onChange={on => {
            update({ ...engine, remember: on });
            if (keyValue) saveKey(engine.provider, keyValue, on);
          }} />
        </>
      ) : (
        <p className="text-small text-ink-2">Scripted answers for trying TI on a development server. No key, no cost, no real analysis.</p>
      )}
    </div>
  );
}

/** What happens to the key, in one honest paragraph. */
export function KeyPrivacy({ engine }: { engine: Engine }) {
  const info = providerInfo(engine.provider);
  if (!info.needsKey) return null;
  return (
    <p className="text-meta text-ink-3">
      The key stays in this browser{engine.remember ? '' : ' tab'} and travels only inside your own requests, which pass it to {shortName(info.name)}. TAKIP never stores or logs it. Use is billed to your {shortName(info.name)} account.
    </p>
  );
}
