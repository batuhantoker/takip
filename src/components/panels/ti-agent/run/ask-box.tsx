'use client';
/** TAKIP TI: questioning a run afterwards: the report agent on why, or an actor on what it would do. */
import { useState } from 'react';
import { ArrowUp, MessageSquare } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, TextField } from '@/components/ui/field';
import type { Engine, OiClient } from '@/lib/oi/client';
import { castOf, type RunState } from '@/lib/oi/state';
import { Mentions } from '@/components/panels/ti-agent/atoms';

export function AskBox({ s, oi, engine, keyValue, ready, target, setTarget, onSelect }: {
  s: RunState; oi: OiClient; engine: Engine; keyValue: string; ready: boolean; target: string; setTarget: (t: string) => void; onSelect: (k: string | null) => void;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ who: string; text: string; you: boolean }[]>([]);
  const cast = castOf(s);
  const targetName = target === 'report' ? 'The report agent' : cast.find(a => a.id === target)?.name ?? target;
  const send = async () => {
    const m = message.trim();
    if (!m || busy) return;
    setBusy(true);
    setLog(l => [...l, { who: 'You', text: m, you: true }]);
    setMessage('');
    const out = await oi.ask(target, m, engine, keyValue);
    setLog(l => [...l, { who: targetName, text: out.reply ?? out.error ?? '…', you: false }]);
    setBusy(false);
  };
  if (!cast.length) return <EmptyState icon={MessageSquare} title="Nobody to ask yet" body="The actors can be questioned once they have been cast." />;
  const closed = !ready || (target === 'report' && !s.report);
  return (
    <div className="flex flex-col gap-4">
      <Select label="Ask" size="sm" value={target} onChange={e => setTarget(e.target.value)}>
        <option value="report" disabled={!s.report}>The report agent{!s.report ? ' (once the prediction is written)' : ''}</option>
        {cast.map(a => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}
      </Select>
      {log.length === 0 && (
        <p className="text-small text-ink-2">Ask the report agent why the prediction landed where it did, or ask an actor what it would do if things changed. Questions run on your key.</p>
      )}
      {log.length > 0 && (
        <div aria-live="polite" className="flex flex-col gap-4">
          {log.map((m, i) => m.you ? (
            <p key={i} className="max-w-[86%] self-end rounded-card bg-surface-2 px-3 py-2 text-body leading-5 whitespace-pre-wrap text-ink-1">{m.text}</p>
          ) : (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-meta font-medium text-ink-3">{m.who}</span>
              <p className="text-body leading-5 whitespace-pre-wrap text-ink-1"><Mentions text={m.text} s={s} onSelect={onSelect} /></p>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={e => { e.preventDefault(); void send(); }}>
        <TextField size="sm" aria-label="Your question" value={message} onChange={e => setMessage(e.target.value.slice(0, 1000))} disabled={closed}
          placeholder={!ready ? 'Add your key to ask' : `Ask ${targetName.replace(/^The /, 'the ')}`}
          trailing={<IconButton type="submit" size="sm" className="-mr-1.5" label="Send" icon={ArrowUp} disabled={closed || busy || !message.trim()} />} />
      </form>
      {busy && <p role="status" className="-mt-2 text-meta text-ink-3">{targetName} is answering…</p>}
    </div>
  );
}
