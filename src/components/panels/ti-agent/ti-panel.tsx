'use client';
/**
 * TAKIP TI: the panel.
 *
 * Two ways to use TI, on the reader's own model key. Assist (the default) is
 * a conversation: ask and TI works the map (flies there, switches layers,
 * finds what is live, marks it, starts forecasts). Forecast is the
 * prediction engine: ask a question, watch the actors play it out in
 * parallel worlds, read the prediction and question the actors.
 *
 * Full screen it opens the TI workspace (workspace/workspace.tsx) with the same two
 * tabs on the left and the globe, research graph, timeline and tables in the
 * middle. The run lives in the page (useAi), so closing this panel leaves the
 * map drawing.
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, History, Maximize2, Plus, SquarePen, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Segmented } from '@/components/ui/segmented';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { PROVIDERS, providerInfo } from '@/lib/ai/providers/catalog';
import { loadEngine, loadKey, type Engine } from '@/lib/ai/client';
import type { AiClient } from './use-ai';
import { resolve } from '@/lib/ai/workspace/selection';
import { TiGlyph, TiGlyphLive } from './atoms';
import type { AiMode } from './ti-mode';
import { AssistView, type TiAssist } from './assist/assist-view';
import { ChatHistory } from './assist/chat-history';
import { EngineMenu } from './engine/engine-menu';
import { KeyCard, type KeyCardControl } from './engine/key-card';
import type { EngineState } from './engine/key-form';
import { AskForm } from './forecast/ask-form';
import { HistoryList } from './forecast/history';
import { Connecting, InjectBox, RunHead, UsageLine, Verdict } from '@/components/panels/ti-agent/run/run';
import { RunTabs, type Tab } from '@/components/panels/ti-agent/run/run-tabs';
import { ObjectView } from '@/components/panels/ti-agent/object/object-view';
import { ScrollBody } from '@/components/panels/ti-agent/parts/scroll-body';
import { Workspace, type Stage } from '@/components/panels/ti-agent/workspace/workspace';
import TiAccountPrompt from '@/components/panels/ti-agent/parts/ti-account-prompt';
import { useEntitlement } from '@/components/site/account/plan-gate';

export interface AiPanelProps {
  ai: AiClient;
  /** What is selected: a node key, or "link:<id>" for an arc. */
  selected: string | null;
  onSelect: (key: string | null) => void;
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  onClose?: () => void;
  /** Inside another container (the phone drawer): no frame of its own, no full screen. */
  embedded?: boolean;
  /** Whether the other map layers are hidden so the analysis stands out, and the switch for it. */
  focus?: boolean;
  onFocus?: () => void;
  /** Full screen: the workspace. */
  theater?: boolean;
  onTheater?: (on: boolean) => void;
  /** Whether the camera is following the run, and the way to ask it to. */
  following?: boolean;
  onFollow?: () => void;
  /** The conversation (it lives in the page, so closing the panel keeps it). */
  assist: TiAssist;
  /** Which way of using TI is showing. */
  mode: AiMode;
  onMode: (m: AiMode) => void;
  /** Read TI's replies aloud. */
  speakOn: boolean;
  onSpeak: (on: boolean) => void;
  /** Put the cursor in the conversation's box when the panel opens. */
  autoFocus?: boolean;
  /** What the workspace's stage shows (globe, graph, timeline, table). */
  stage: Stage;
  onStage: (s: Stage) => void;
}

export type { AiMode };

export const MODE_OPTIONS: { value: AiMode; label: string }[] = [
  { value: 'assist', label: msg('Assist') },
  { value: 'forecast', label: msg('Forecast') },
];

/** The engine this browser last used, or OpenAI with its default model. */
function initialEngine(): Engine {
  const saved = loadEngine();
  if (saved && PROVIDERS.some(p => p.id === saved.provider)) return saved;
  return { provider: 'openai', model: providerInfo('openai').defaultModel, remember: false };
}

function ErrorNote({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-card border border-red/30 bg-red/10 py-1.5 pr-1.5 pl-3">
      <span className="min-w-0 flex-1 py-1 text-small text-ink-1">{text}</span>
      <IconButton size="sm" label={t('Dismiss')} icon={X} onClick={onDismiss} />
    </div>
  );
}

/** A plan without `ai.assistant` gets the account prompt; until the plan is known, TI. */
export default function AiPanel(props: AiPanelProps) {
  const allowed = useEntitlement('ai.assistant');
  return allowed === false ? <TiAccountPrompt embedded={!!props.embedded} onClose={props.onClose} /> : <TiPanelBody {...props} />;
}

function TiPanelBody(props: AiPanelProps) {
  const { ai, selected, onSelect, embedded = false, theater = false, assist } = props;
  const t = useT();
  const modeOptions = MODE_OPTIONS.map(o => ({ ...o, label: t(o.label) }));
  // Settings come from this browser's storage. The panel only renders once opened, on the client.
  const [engine, setEngine] = useState<Engine>(initialEngine);
  const [key, setKey] = useState(() => loadKey(initialEngine().provider));
  const [engineOpen, setEngineOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChats, setShowChats] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [askTarget, setAskTarget] = useState('report');

  const s = ai.state;
  const info = providerInfo(engine.provider);
  const ready = !info.needsKey || key.length > 0;
  const selection = s ? resolve(s, selected) : null;
  // Until someone picks a tab: the simulation while it runs, the prediction once there is one.
  const activeTab: Tab = tab ?? (s?.report ? 'report' : 'sim');
  // A run is open but its first event has not arrived yet.
  const connecting = Boolean(ai.runId) && !s;
  const forecasting = props.mode === 'forecast';
  const live = s?.status === 'running' || assist.busy;
  const engineState: EngineState = { engine, setEngine, keyValue: key, setKey };

  // Asking an actor opens the Ask list; in the workspace that means stepping back from the object to the lists.
  const askActor = (id: string) => { setAskTarget(id); setTab('ask'); if (theater) onSelect(null); };
  const reset = () => { ai.clear(); onSelect(null); setShowHistory(false); setTab(null); };
  const watch = (id: string) => { setShowHistory(false); setTab(null); onSelect(null); void ai.watch(id); };

  const errorNote = ai.error ? <ErrorNote text={ai.error} onDismiss={() => ai.setError('')} /> : null;
  const keyCard = (note?: ReactNode, control?: KeyCardControl) => <KeyCard {...engineState} note={note} {...control} />;
  const history = <HistoryList ai={ai} onPick={watch} />;

  const lists = s ? (
    <RunTabs s={s} tab={activeTab} setTab={setTab} ai={ai} engine={engine} keyValue={key} ready={ready}
      selected={selected} onSelect={onSelect} askTarget={askTarget} setAskTarget={setAskTarget} theater={theater} />
  ) : null;

  const assistView = (
    <AssistView assist={assist} ai={ai} ready={ready} embedded={embedded} keyCard={control => keyCard(undefined, control)}
      onSend={(text, m) => void assist.send(text, m, { engine, key })}
      onLocate={props.onLocate} onOpenForecast={() => props.onMode('forecast')}
      onWorkspace={!embedded && !theater && props.onTheater ? () => props.onTheater?.(true) : undefined}
      speakOn={props.speakOn} onSpeak={props.onSpeak} autoFocus={props.autoFocus} auth={{ engine, key }} />
  );

  const assistActions = (
    <>
      <IconButton label={t('Saved chats')} icon={History} onClick={() => setShowChats(v => !v)} />
      {assist.entries.length > 0 && <IconButton label={t('New conversation')} icon={SquarePen} onClick={() => { setShowChats(false); assist.clear(); }} />}
    </>
  );
  const assistBody = showChats
    ? <ChatHistory currentId={assist.chatId} embedded={embedded} onOpen={id => { setShowChats(false); assist.openChat(id); }} onDelete={assist.deleteChat} />
    : assistView;

  const askForm = (
    <AskForm ready={ready} providerName={info.name} keyCard={note => keyCard(note)}
      below={<>{errorNote}{history}</>}
      onRun={async input => {
        const id = await ai.start(input, engine, key);
        if (id) { setShowHistory(false); setTab(null); onSelect(null); }
        return Boolean(id);
      }} />
  );

  const engineMenu = <EngineMenu {...engineState} open={engineOpen} onOpenChange={setEngineOpen} />;

  /* ── Full screen: the workspace, with or without a run ── */
  if (theater && !embedded) {
    const node = (
      <Workspace s={s} ai={ai} selected={selected} onSelect={onSelect} onLocate={props.onLocate} onAsk={askActor}
        onTheater={props.onTheater} focus={props.focus} onFocus={props.onFocus} following={props.following} onFollow={props.onFollow}
        mode={props.mode} onMode={props.onMode} stage={props.stage} onStage={props.onStage}
        lists={lists} errorBox={errorNote} assistView={assistBody} askView={connecting ? <Connecting onCancel={reset} /> : askForm}
        engineMenu={engineMenu} assistActions={assistActions} onNewForecast={reset} assistBusy={assist.busy} />
    );
    return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
  }

  /* ── A run: the question, the prediction, then its lists ── */
  const runView = s && (
    <ScrollBody>
      {errorNote}
      <RunHead s={s} ai={ai} focus={props.focus} onFocus={props.onFocus} following={props.following} onFollow={props.onFollow} />
      <div className="mt-6"><Verdict key={ai.runId ?? ''} s={s} /></div>
      {selection && (
        <div className="mt-6">
          <ObjectView key={selection.key} s={s} sel={selection} onSelect={onSelect} onLocate={props.onLocate} onAsk={askActor} />
        </div>
      )}
      {s.status === 'running' && ai.canSteer && <div className="mt-6"><InjectBox ai={ai} s={s} /></div>}
      <div className="mt-6">{lists}</div>
    </ScrollBody>
  );

  const forecastBody = showHistory && s ? (
    <ScrollBody>{history}</ScrollBody>
  ) : !s ? (
    connecting ? <ScrollBody><Connecting onCancel={reset} /></ScrollBody> : askForm
  ) : runView;

  const body = forecasting ? forecastBody : assistBody;

  /* ── In the phone drawer, which has its own header and scroll ── */
  if (embedded) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1">
          <Segmented size="sm" full semantics="tabs" label="TI" value={props.mode} onChange={props.onMode} options={modeOptions} className="min-w-0 flex-1" />
          {!forecasting && assistActions}
        </div>
        <div className="-mx-3 flex flex-col">{body}</div>
      </div>
    );
  }

  const model = ready ? engine.model : '';
  const footer = !forecasting || !s ? undefined : showHistory ? (
    <Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2" onClick={() => setShowHistory(false)}>{t('Back to the forecast')}</Button>
  ) : (
    <>
      <UsageLine s={s} />
      {ai.history.length > 0 && <Button variant="ghost" size="sm" icon={History} className="-mr-2" onClick={() => setShowHistory(true)}>{t('Your forecasts')}</Button>}
    </>
  );
  return (
    <Panel title="TI" subtitle={model ? `Takip AI · ${model}` : 'Takip AI'} icon={live ? TiGlyphLive : TiGlyph} bare
      tabs={{ options: modeOptions, value: props.mode, onChange: props.onMode }}
      onClose={props.onClose} footer={footer}
      actions={(
        <>
          {forecasting && s && <IconButton label={t('New forecast')} icon={Plus} onClick={reset} />}
          {!forecasting && assistActions}
          {engineMenu}
          {props.onTheater && <IconButton label={t('Open the workspace')} icon={Maximize2} onClick={() => props.onTheater?.(true)} />}
        </>
      )}>
      {body}
    </Panel>
  );
}
