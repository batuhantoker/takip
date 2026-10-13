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
 * middle. The run lives in the page (useOi), so closing this panel leaves the
 * map drawing.
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, History, Maximize2, Plus, SquarePen, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Segmented } from '@/components/ui/segmented';
import { PROVIDERS, providerInfo } from '@/lib/oi/providers';
import { loadEngine, loadKey, type Engine, type OiClient } from '@/lib/oi/client';
import { resolve } from '@/lib/oi/research';
import { TiGlyph, TiGlyphLive } from './atoms';
import type { OiMode } from './ti-mode';
import { AssistView, type TiAssist } from './assist/assist-view';
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

export interface OiPanelProps {
  oi: OiClient;
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
  mode: OiMode;
  onMode: (m: OiMode) => void;
  /** Read TI's replies aloud. */
  speakOn: boolean;
  onSpeak: (on: boolean) => void;
  /** Put the cursor in the conversation's box when the panel opens. */
  autoFocus?: boolean;
  /** What the workspace's stage shows (globe, graph, timeline, table). */
  stage: Stage;
  onStage: (s: Stage) => void;
}

export type { OiMode };

export const MODE_OPTIONS: { value: OiMode; label: string }[] = [
  { value: 'assist', label: 'Assist' },
  { value: 'forecast', label: 'Forecast' },
];

/** The engine this browser last used, or OpenAI with its default model. */
function initialEngine(): Engine {
  const saved = loadEngine();
  if (saved && PROVIDERS.some(p => p.id === saved.provider)) return saved;
  return { provider: 'openai', model: providerInfo('openai').defaultModel, remember: false };
}

function ErrorNote({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-card border border-red/30 bg-red/10 py-1.5 pr-1.5 pl-3">
      <span className="min-w-0 flex-1 py-1 text-small text-ink-1">{text}</span>
      <IconButton size="sm" label="Dismiss" icon={X} onClick={onDismiss} />
    </div>
  );
}

export default function OiPanel(props: OiPanelProps) {
  const { oi, selected, onSelect, embedded = false, theater = false, assist } = props;
  // Settings come from this browser's storage. The panel only renders once opened, on the client.
  const [engine, setEngine] = useState<Engine>(initialEngine);
  const [key, setKey] = useState(() => loadKey(initialEngine().provider));
  const [engineOpen, setEngineOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [askTarget, setAskTarget] = useState('report');

  const s = oi.state;
  const info = providerInfo(engine.provider);
  const ready = !info.needsKey || key.length > 0;
  const selection = s ? resolve(s, selected) : null;
  // Until someone picks a tab: the simulation while it runs, the prediction once there is one.
  const activeTab: Tab = tab ?? (s?.report ? 'report' : 'sim');
  // A run is open but its first event has not arrived yet.
  const connecting = Boolean(oi.runId) && !s;
  const forecasting = props.mode === 'forecast';
  const live = s?.status === 'running' || assist.busy;
  const engineState: EngineState = { engine, setEngine, keyValue: key, setKey };

  // Asking an actor opens the Ask list; in the workspace that means stepping back from the object to the lists.
  const askActor = (id: string) => { setAskTarget(id); setTab('ask'); if (theater) onSelect(null); };
  const reset = () => { oi.clear(); onSelect(null); setShowHistory(false); setTab(null); };
  const watch = (id: string) => { setShowHistory(false); setTab(null); onSelect(null); void oi.watch(id); };

  const errorNote = oi.error ? <ErrorNote text={oi.error} onDismiss={() => oi.setError('')} /> : null;
  const keyCard = (note?: ReactNode, control?: KeyCardControl) => <KeyCard {...engineState} note={note} {...control} />;
  const history = <HistoryList oi={oi} onPick={watch} />;

  const lists = s ? (
    <RunTabs s={s} tab={activeTab} setTab={setTab} oi={oi} engine={engine} keyValue={key} ready={ready}
      selected={selected} onSelect={onSelect} askTarget={askTarget} setAskTarget={setAskTarget} theater={theater} />
  ) : null;

  const assistView = (
    <AssistView assist={assist} oi={oi} ready={ready} embedded={embedded} keyCard={control => keyCard(undefined, control)}
      onSend={(text, m) => void assist.send(text, m, { engine, key })}
      onLocate={props.onLocate} onOpenForecast={() => props.onMode('forecast')}
      onWorkspace={!embedded && !theater && props.onTheater ? () => props.onTheater?.(true) : undefined}
      speakOn={props.speakOn} onSpeak={props.onSpeak} autoFocus={props.autoFocus} />
  );

  const askForm = (
    <AskForm ready={ready} providerName={info.name} keyCard={note => keyCard(note)}
      below={<>{errorNote}{history}</>}
      onRun={async input => {
        const id = await oi.start(input, engine, key);
        if (id) { setShowHistory(false); setTab(null); onSelect(null); }
        return Boolean(id);
      }} />
  );

  const engineMenu = <EngineMenu {...engineState} open={engineOpen} onOpenChange={setEngineOpen} />;

  /* ── Full screen: the workspace, with or without a run ── */
  if (theater && !embedded) {
    const node = (
      <Workspace s={s} oi={oi} selected={selected} onSelect={onSelect} onLocate={props.onLocate} onAsk={askActor}
        onTheater={props.onTheater} focus={props.focus} onFocus={props.onFocus} following={props.following} onFollow={props.onFollow}
        mode={props.mode} onMode={props.onMode} stage={props.stage} onStage={props.onStage}
        lists={lists} errorBox={errorNote} assistView={assistView} askView={connecting ? <Connecting onCancel={reset} /> : askForm}
        engineMenu={engineMenu} onNewForecast={reset} assistBusy={assist.busy} />
    );
    return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
  }

  /* ── A run: the question, the prediction, then its lists ── */
  const runView = s && (
    <ScrollBody>
      {errorNote}
      <RunHead s={s} oi={oi} focus={props.focus} onFocus={props.onFocus} following={props.following} onFollow={props.onFollow} />
      <div className="mt-6"><Verdict key={oi.runId ?? ''} s={s} /></div>
      {selection && (
        <div className="mt-6">
          <ObjectView key={selection.key} s={s} sel={selection} onSelect={onSelect} onLocate={props.onLocate} onAsk={askActor} />
        </div>
      )}
      {s.status === 'running' && oi.canSteer && <div className="mt-6"><InjectBox oi={oi} s={s} /></div>}
      <div className="mt-6">{lists}</div>
    </ScrollBody>
  );

  const forecastBody = showHistory && s ? (
    <ScrollBody>{history}</ScrollBody>
  ) : !s ? (
    connecting ? <ScrollBody><Connecting onCancel={reset} /></ScrollBody> : askForm
  ) : runView;

  const body = forecasting ? forecastBody : assistView;

  /* ── In the phone drawer, which has its own header and scroll ── */
  if (embedded) {
    return (
      <div className="flex flex-col gap-3">
        <Segmented size="sm" full semantics="tabs" label="TI" value={props.mode} onChange={props.onMode} options={MODE_OPTIONS} />
        <div className="-mx-3 flex flex-col">{body}</div>
      </div>
    );
  }

  const model = ready ? engine.model : '';
  const footer = !forecasting || !s ? undefined : showHistory ? (
    <Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2" onClick={() => setShowHistory(false)}>Back to the forecast</Button>
  ) : (
    <>
      <UsageLine s={s} />
      {oi.history.length > 0 && <Button variant="ghost" size="sm" icon={History} className="-mr-2" onClick={() => setShowHistory(true)}>Your forecasts</Button>}
    </>
  );
  return (
    <Panel title="TI" subtitle={model ? `Takip AI · ${model}` : 'Takip AI'} icon={live ? TiGlyphLive : TiGlyph} bare
      tabs={{ options: MODE_OPTIONS, value: props.mode, onChange: props.onMode }}
      onClose={props.onClose} footer={footer}
      actions={(
        <>
          {forecasting && s && <IconButton label="New forecast" icon={Plus} onClick={reset} />}
          {!forecasting && assist.entries.length > 0 && <IconButton label="New conversation" icon={SquarePen} onClick={assist.clear} />}
          {engineMenu}
          {props.onTheater && <IconButton label="Open the workspace" icon={Maximize2} onClick={() => props.onTheater?.(true)} />}
        </>
      )}>
      {body}
    </Panel>
  );
}
