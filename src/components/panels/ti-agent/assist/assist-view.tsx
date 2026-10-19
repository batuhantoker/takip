'use client';
/**
 * TAKIP TI Assist: the conversation.
 *
 * Talk to TI, typed or spoken, and it works the map for you: it flies there,
 * switches the layers on, finds what is live, marks it, and puts it on screen
 * as lists you can click through; it reads the markets, opens panels and
 * starts forecasts. Each turn shows what TI did as it does it, with a way to
 * look again or take it back.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigation, ScanSearch, Search, type LucideIcon } from 'lucide-react';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { AiClient } from '@/components/panels/ti-agent/use-ai';
import type { AssistClient, Auth } from './use-assist';
import { useLiveVoice } from './use-live-voice';
import type { Mode } from '@/lib/ai/assist/protocol';
import type { KeyCardControl } from '../engine/key-card';
import { ScrollBody } from '@/components/panels/ti-agent/parts/scroll-body';
import { Composer } from './composer';
import { Turn } from './turn';
import { canSpeak, useDictation } from './voice';

/** Three things worth trying first: go somewhere, find what is live, and make sense of the view. */
const SUGGESTIONS: { icon: LucideIcon; text: string; mode: Mode }[] = [
  { icon: Navigation, text: msg('Show the ships in the Strait of Hormuz'), mode: 'navigate' },
  { icon: Search, text: msg('Military aircraft near the Baltic Sea'), mode: 'research' },
  { icon: ScanSearch, text: msg('What am I looking at?'), mode: 'research' },
];

export type TiAssist = AssistClient & {
  /** Switch map layers on and off: how TI's own switching is taken back. */
  setLayers?: (on: string[], off: string[]) => void;
};

export interface AssistViewProps {
  assist: TiAssist;
  ai: AiClient;
  ready: boolean;
  onSend: (text: string, mode: Mode) => void;
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  onOpenForecast: () => void;
  onWorkspace?: () => void;
  speakOn: boolean;
  onSpeak: (on: boolean) => void;
  /** Focus the composer on mount (opened from the keyboard). */
  autoFocus?: boolean;
  /** Shown in place of the composer until there is a key. */
  keyCard: (control: KeyCardControl) => ReactNode;
  /** In the phone drawer, which scrolls as a whole. */
  embedded?: boolean;
  /** The engine and key, for a live voice conversation (OpenAI only). */
  auth?: Auth;
}

const DRAFT = 'takip.ai.assist.draft';

function readDraft(): { text: string; mode: Mode } {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT) || 'null');
    if (d && typeof d.text === 'string') return { text: d.text, mode: d.mode ?? 'auto' };
  } catch { /* storage blocked */ }
  return { text: '', mode: 'auto' };
}

export function AssistView(p: AssistViewProps) {
  const { assist } = p;
  const t = useT();
  const [draft] = useState(readDraft);
  const [text, setText] = useState(draft.text);
  const [mode, setMode] = useState<Mode>(draft.mode);
  const [addingKey, setAddingKey] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  // Escape in the box closes the panel: what was typed is there when it opens again.
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify({ text, mode })); } catch { /* storage blocked */ } }, [text, mode]);
  const scroller = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const send = (said: string, m: Mode = mode) => {
    if (!said.trim() || !p.ready || assist.busy) return;
    p.onSend(said.trim(), m);
    setText('');
  };
  const dictation = useDictation(heard => send(heard));
  const live = useLiveVoice(assist, p.ready ? p.auth ?? null : null);

  useEffect(() => { if (p.autoFocus) input.current?.focus(); }, [p.autoFocus]);
  // A key just arrived for a question that was waiting: put the cursor on it, ready to send.
  useEffect(() => { if (p.ready && text) input.current?.focus(); }, [p.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = assist.entries[assist.entries.length - 1];
  const lastSize = last ? (last.role === 'ai' ? last.says.length + last.actions.length + last.cards.length + (last.busy ? 0 : 100) : 1) : 0;
  useEffect(() => {
    if (p.embedded) { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); return; }
    const el = scroller.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [assist.entries.length, lastSize, p.embedded]);

  // Without a key a suggestion waits in the box while the key goes in.
  const tryIt = (said: string, m: Mode) => {
    if (p.ready) send(said, m);
    else { setText(said); setMode(m); setAddingKey(true); }
  };

  const body = assist.entries.length === 0 ? (
    <div>
      <p className="text-body leading-5 text-ink-2">
        {t('Ask about anything on the map. TI can fly there, switch on the right layers and mark what it finds.')}
      </p>
      <PanelSection title={t('Try asking')}>
        {SUGGESTIONS.map(s => {
          const Icon = s.icon;
          return <ListRow key={s.text} leading={<Icon aria-hidden className="size-4" strokeWidth={1.75} />} title={t(s.text)} onClick={() => tryIt(t(s.text), s.mode)} />;
        })}
      </PanelSection>
    </div>
  ) : (
    <div className="flex flex-col gap-6" aria-live="polite">
      {assist.entries.map(e => (
        <Turn key={e.id} e={e} ai={p.ai} hands={{ onLocate: p.onLocate, setLayers: assist.setLayers }}
          onOpenForecast={p.onOpenForecast} onWorkspace={p.onWorkspace} onRetry={(said, m) => send(said, m)} />
      ))}
    </div>
  );

  const composer = p.ready ? (
    <Composer ref={input} text={text} onText={setText} mode={mode} onMode={setMode} onSend={() => send(text)}
      busy={assist.busy} onStop={assist.stop} dictation={dictation} speakOn={p.speakOn} onSpeak={canSpeak() ? p.onSpeak : undefined} live={live} />
  ) : p.keyCard({ adding: addingKey, onAdding: setAddingKey, waiting: text.trim() || undefined });

  if (p.embedded) {
    return (
      <div className="flex flex-col">
        <div className="px-4 pb-4">{body}<div ref={end} /></div>
        <div className="sticky bottom-0 border-t border-line bg-surface-1 px-4 pt-3 pb-1">{composer}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollBody ref={scroller}>{body}</ScrollBody>
      <div className="shrink-0 border-t border-line px-4 pt-3 pb-3">{composer}</div>
    </div>
  );
}
