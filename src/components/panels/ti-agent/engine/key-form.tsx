'use client';
/**
 * TAKIP TI: the reader's own key. Which provider, the key itself, whether
 * this device remembers it, and a check that it works (which also lists the
 * models it can use).
 */
import { useEffect, useState } from 'react';
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Select, Switch, TextField } from '@/components/ui/field';
import { useT } from '@/components/ui/use-t';
import { PROVIDERS, providerInfo, type ProviderId } from '@/lib/ai/providers/catalog';
import { checkKey, forgetKey, loadKey, saveEngine, saveKey, type Engine } from '@/lib/ai/client';
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
  const t = useT();
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
    setStatus({ kind: 'ok', text: t('{n, plural, one {Key works · # model available} other {Key works · # models available}}', { n: out.models.length }) });
    setTimeout(() => setStatus(st => (st.kind === 'ok' ? { kind: 'idle', text: '' } : st)), 4000);
    onSaved?.();
  };

  /** Local models: what the server has installed, which also checks it is running. An empty address finds one. */
  const [address, setAddress] = useState(engine.base ?? '');
  const connectLocal = async (base = engine.base ?? '') => {
    setStatus({ kind: 'checking', text: '' });
    const out = await checkKey('local', '', base);
    if ('error' in out) { setStatus({ kind: 'error', text: out.error }); onModels?.(null); return; }
    onModels?.({ models: out.models, listed: out.listed });
    const model = out.models.some(m => m.id === engine.model) ? engine.model : out.preferred || engine.model;
    const next = { ...engine, model, ...(base ? { base } : {}) };
    if (!base) delete next.base;
    if (model !== engine.model || next.base !== engine.base) update(next);
    const address = out.base ? out.base.replace(/^https?:\/\//, '').replace(/\/v1$/, '') : '';
    setStatus({ kind: 'ok', text: address
      ? t('{n, plural, one {# model at {address}} other {# models at {address}}}', { n: out.models.length, address })
      : t('{n, plural, one {# model} other {# models}}', { n: out.models.length }) });
  };
  // Chosen, or opened while chosen: ask the server what it has.
  useEffect(() => {
    if (engine.provider !== 'local') return;
    const timer = setTimeout(() => void connectLocal(), 0);
    return () => clearTimeout(timer);
  }, [engine.provider]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <Select label={t('Provider')} size="sm" value={engine.provider} onChange={e => pickProvider(e.target.value as ProviderId)}
        options={PROVIDERS.map(p => ({ value: p.id, label: p.id === 'local' ? t('Local models') : p.id === 'demo' ? t('Demo') : shortName(p.name) }))} />

      {info.needsKey ? (
        <>
          <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); void save(); }}>
            <TextField label={t('{provider} key', { provider: shortName(info.name) })} size="sm" className="min-w-0 flex-1"
              type={reveal ? 'text' : 'password'} value={draft} autoFocus={autoFocus}
              onChange={e => { setDraft(e.target.value.trim()); setStatus({ kind: 'idle', text: '' }); }}
              placeholder={info.keyHint} autoComplete="off" spellCheck={false} data-1p-ignore data-lpignore="true"
              trailing={<IconButton size="sm" className="-mr-1.5" label={reveal ? t('Hide key') : t('Show key')} icon={reveal ? EyeOff : Eye} onClick={() => setReveal(v => !v)} />} />
            <Button type="submit" size="sm" variant={changed ? 'primary' : 'secondary'} disabled={!draft} loading={status.kind === 'checking'}>
              {changed || !keyValue ? t('Save') : t('Check')}
            </Button>
          </form>
          {/* One line under the field: how the check went, else the way to get a key or to drop the saved one. */}
          {status.text ? (
            <p role="status" className={cx('-mt-1.5 text-meta', status.kind === 'error' ? 'text-red' : 'text-green')}>{status.text}</p>
          ) : keyValue ? (
            <button type="button" onClick={forget} className={cx('-mt-1.5 self-start rounded-control text-meta text-ink-3 hover:text-red', FOCUS_RING)}>{t('Forget this key')}</button>
          ) : info.keyUrl ? (
            <a href={info.keyUrl} target="_blank" rel="noopener noreferrer" className={cx('-mt-1.5 inline-flex items-center gap-0.5 self-start rounded-control text-meta text-accent hover:underline', FOCUS_RING)}>
              {t('Get a key from {provider}', { provider: shortName(info.name) })}<ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
            </a>
          ) : null}
          <Switch size="sm" label={t('Remember on this device')} checked={engine.remember} onChange={on => {
            update({ ...engine, remember: on });
            if (keyValue) saveKey(engine.provider, keyValue, on);
          }} />
        </>
      ) : engine.provider === 'local' ? (
        <>
          <p className="text-small text-ink-2">
            {t("Models you run yourself (Ollama, LM Studio, llama.cpp or vLLM) through their OpenAI-compatible API, reached from TAKIP's server. No key and no cost; speed depends on the hardware. Leave the address empty to find one on the usual ports, or give its host and port.")}
          </p>
          <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); void connectLocal(address.trim()); }}>
            <TextField label={t('Address')} size="sm" className="min-w-0 flex-1" value={address} spellCheck={false} autoComplete="off"
              onChange={e => { setAddress(e.target.value.trim()); setStatus({ kind: 'idle', text: '' }); }}
              placeholder={t('Found automatically, or 127.0.0.1:8080')} />
            <Button type="submit" size="sm" variant={address.trim() !== (engine.base ?? '') ? 'primary' : 'secondary'} loading={status.kind === 'checking'}>
              {address.trim() !== (engine.base ?? '') ? t('Connect') : t('Check')}
            </Button>
          </form>
          {status.text && <p role="status" className={cx('-mt-1.5 text-meta', status.kind === 'error' ? 'text-red' : 'text-green')}>{status.text}</p>}
        </>
      ) : (
        <p className="text-small text-ink-2">{t('Scripted answers for trying TI on a development server. No key, no cost, no real analysis.')}</p>
      )}
    </div>
  );
}

/** What happens to the key, in one honest paragraph. */
export function KeyPrivacy({ engine }: { engine: Engine }) {
  const t = useT();
  const info = providerInfo(engine.provider);
  if (!info.needsKey) return null;
  const provider = shortName(info.name);
  return (
    <p className="text-meta text-ink-3">
      {engine.remember
        ? t('The key stays in this browser and travels only inside your own requests, which pass it to {provider}. TAKIP never stores or logs it. Use is billed to your {provider} account.', { provider })
        : t('The key stays in this browser tab and travels only inside your own requests, which pass it to {provider}. TAKIP never stores or logs it. Use is billed to your {provider} account.', { provider })}
    </p>
  );
}
