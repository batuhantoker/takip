'use client';
/** TAKIP TI Assist: where the reader writes, or speaks, to TI. */
import { forwardRef } from 'react';
import { ArrowUp, AudioLines, Check, ChevronDown, Mic, Square, Volume2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import type { Mode } from '@/lib/ai/assist/protocol';
import { TextArea } from '@/components/panels/ti-agent/parts/text-area';
import type { LiveVoice, VoiceState } from './use-live-voice';

const LIVE_WORDS: Record<VoiceState, string> = {
  idle: '', connecting: 'Connecting…', listening: 'Listening: just talk', thinking: 'TI is working…', speaking: 'TI is speaking', error: '',
};

export const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'TI decides' },
  { value: 'navigate', label: 'Navigate', hint: 'Map and layers' },
  { value: 'research', label: 'Research', hint: 'Live data' },
  { value: 'forecast', label: 'Forecast', hint: 'Prediction engine' },
];

function ModeMenu({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  const current = MODES.find(m => m.value === mode) ?? MODES[0];
  return (
    <Popover role="menu" label="How TI answers" placement="top" align="start" className="w-[232px] p-1"
      trigger={<Button variant="ghost" size="sm" aria-label={`Mode: ${current.label}`}>{current.label}<ChevronDown aria-hidden className="-mr-0.5 size-3.5 text-ink-3" strokeWidth={1.75} /></Button>}>
      {close => MODES.map(m => (
        <MenuItem key={m.value} selected={m.value === mode} hint={m.hint} icon={m.value === mode ? Check : undefined}
          onSelect={() => { onMode(m.value); close(); }}>
          <span className={m.value === mode ? undefined : 'pl-[26px]'}>{m.label}</span>
        </MenuItem>
      ))}
    </Popover>
  );
}

/** Send, and Stop while TI is working: the one filled control in the composer. */
function SendButton({ busy, disabled, onSend, onStop }: { busy: boolean; disabled: boolean; onSend: () => void; onStop: () => void }) {
  const Icon = busy ? Square : ArrowUp;
  return (
    <Tooltip label={busy ? 'Stop' : 'Send'} kbd={busy ? undefined : '↵'}>
      <button type="button" aria-label={busy ? 'Stop' : 'Send'} disabled={!busy && disabled} onClick={busy ? onStop : onSend}
        className={cx('flex size-7 shrink-0 items-center justify-center rounded-control disabled:cursor-not-allowed',
          busy ? 'bg-surface-3 text-ink-1 hover:bg-line-strong' : disabled ? 'bg-surface-3 text-ink-3' : 'bg-accent text-on-accent hover:bg-accent/90',
          FOCUS_RING, TRANSITION)}>
        <Icon aria-hidden className={busy ? 'size-3 fill-current' : 'size-4'} strokeWidth={busy ? 0 : 2} />
      </button>
    </Tooltip>
  );
}

export interface ComposerProps {
  text: string;
  onText: (t: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  onSend: () => void;
  busy: boolean;
  onStop: () => void;
  /** Dictation: what is being heard, and the switch for it. */
  dictation: { supported: boolean; listening: boolean; heard: string; error: string; start: () => void; stop: () => void };
  speakOn: boolean;
  onSpeak?: (on: boolean) => void;
  /** A spoken conversation over OpenAI Realtime, when the engine is OpenAI. */
  live?: LiveVoice;
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(p, ref) {
  const { dictation, live } = p;
  const talking = Boolean(live && live.state !== 'idle' && live.state !== 'error');
  const canSend = Boolean(p.text.trim()) && !dictation.listening && !talking;
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-card border border-line-strong bg-surface-2 transition-colors duration-150 focus-within:border-accent">
        <TextArea ref={ref} bare maxRows={6} value={dictation.listening ? dictation.heard : p.text} readOnly={dictation.listening}
          onChange={e => p.onText(e.target.value.slice(0, 2000))}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend && !p.busy) p.onSend(); } }}
          placeholder={talking ? LIVE_WORDS[live!.state] : dictation.listening ? 'Listening…' : p.mode === 'forecast' ? 'What should TI forecast?' : 'Ask TI…'}
          aria-label="Message to TI" className="px-3 pt-2.5 pb-1" />
        <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
          <ModeMenu mode={p.mode} onMode={p.onMode} />
          <span className="flex-1" />
          {p.onSpeak && (
            <IconButton size="sm" label={p.speakOn ? 'Stop reading replies aloud' : 'Read replies aloud'} icon={Volume2}
              active={p.speakOn} onClick={() => p.onSpeak?.(!p.speakOn)} tooltipSide="top" />
          )}
          {live?.available && (
            <IconButton size="sm" label={talking ? 'End the voice conversation' : 'Talk with TI'} icon={AudioLines} active={talking}
              disabled={p.busy && !talking} onClick={() => (talking ? live.stop() : void live.start())} tooltipSide="top" />
          )}
          {dictation.supported && !talking && (
            <IconButton size="sm" label={dictation.listening ? 'Stop listening' : 'Dictate'} icon={Mic} active={dictation.listening}
              disabled={p.busy} onClick={() => (dictation.listening ? dictation.stop() : dictation.start())} tooltipSide="top" />
          )}
          <span className="ml-1"><SendButton busy={p.busy} disabled={!canSend} onSend={p.onSend} onStop={p.onStop} /></span>
        </div>
      </div>
      <p className={cx('text-meta', dictation.error || live?.error ? 'text-red' : 'text-ink-3')}>
        {live?.error || dictation.error || (talking ? 'Live voice on your OpenAI key, billed by OpenAI per minute. TI hears you, answers aloud and works the map.' : dictation.listening ? 'Speak, then pause: TI sends what it heard.' : 'Enter to send · Shift+Enter for a new line')}
      </p>
    </div>
  );
});
