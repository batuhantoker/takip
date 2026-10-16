'use client';
/** TAKIP TI: the model and key, from the panel's header. */
import { useMemo, useRef, useState, type ComponentProps, type MouseEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { saveEngine } from '@/lib/ai/client';
import { providerInfo } from '@/lib/ai/providers/catalog';
import { KeyForm, KeyPrivacy, type EngineState, type ModelList } from './key-form';
import { ModelPicker } from './model-picker';

/** Provider, key and model, in one place: the popover's body, also usable inline. */
export function EngineSheet(p: EngineState) {
  const { engine, setEngine } = p;
  const info = providerInfo(engine.provider);
  const [list, setList] = useState<ModelList | null>(null);
  const known = useMemo(() => info.suggested.map(id => ({ id, name: id })), [info.suggested]);
  return (
    <div className="flex flex-col gap-5">
      <KeyForm {...p} onModels={setList} />
      <section className="flex flex-col gap-2">
        <h3 className="flex items-baseline gap-2 text-meta font-medium text-ink-3">
          <span className="flex-1">Model</span>
          <span className="font-normal">{list ? (list.listed ? `${list.models.length} ${info.needsKey ? 'on this key' : 'installed'}` : 'Known names') : info.needsKey ? 'Recommended' : ''}</span>
        </h3>
        <ModelPicker provider={engine.provider} models={list?.models ?? known} value={engine.model}
          onChange={model => { const next = { ...engine, model }; setEngine(next); saveEngine(next); }}
          suggested={info.suggested} defaultModel={info.defaultModel} listed={Boolean(list?.listed)} />
        {!list && info.needsKey && <p className="text-meta text-ink-3">Check the key to list every model it can use.</p>}
      </section>
      <KeyPrivacy engine={engine} />
    </div>
  );
}

/** IconButton's tooltip wrapper is display: contents, which gives Popover no box to anchor to; this span gives it one. */
function Anchored({ onClick, ...rest }: Omit<ComponentProps<typeof IconButton>, 'onClick'> & { onClick?: (e: MouseEvent<HTMLElement>) => void }) {
  return <span className="inline-flex" onClick={onClick}><IconButton {...rest} /></span>;
}

export function EngineMenu({ open, onOpenChange, ...p }: EngineState & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  return (
    <Popover open={open} onOpenChange={onOpenChange} placement="bottom" align="end" label="Model and key" className="w-[300px] p-4"
      trigger={<Anchored ref={button} label="Model and key" icon={KeyRound} active={open} aria-expanded={open} aria-haspopup="dialog" />}>
      {/* Popover hands focus back to its anchor, which here is the span: send it to the button instead. */}
      <div onKeyDown={e => { if (e.key === 'Escape' && !e.defaultPrevented) requestAnimationFrame(() => button.current?.focus()); }}>
        <EngineSheet {...p} />
      </div>
    </Popover>
  );
}
