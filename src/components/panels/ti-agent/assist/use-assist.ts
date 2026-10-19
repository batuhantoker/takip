'use client';
/**
 * TAKIP AI Assist: the conversation, in the page.
 *
 * Holds what has been said and done, runs a turn against the server and the
 * map (agent.converse), and shows each step as it happens: what AI said, each
 * action with its state, and the cards it put on screen. The conversation is
 * kept for the browser session, so a reload or closing the panel loses nothing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorOf, headersFor, type Engine } from '@/lib/ai/client';
import { converse } from '@/lib/ai/assist/agent';
import { FIND_LAYERS, LAYERS, SOURCES } from '@/lib/ai/assist/catalog';
import { feedProblems } from '@/lib/ai/assist/feed-state';
import { feedMarks } from '@/lib/core/feed-log';
import { t } from '@/lib/core/i18n/active';
import { asksForForecast, type AssistContext, type AssistMessage, type Call, type Mode, type ToolName } from '@/lib/ai/assist/protocol';
import { runCall, type Card, type Depth, type Outcome, type Site } from '@/lib/ai/assist/tools';
import { hasContent, loadChats, removeChat, titleOf, upsertChat } from './chat-store';
import { countAction } from '@/lib/platform/usage-actions';

export interface ActionView {
  tool: ToolName;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'ok' | 'error';
  summary?: string;
}

export type Entry =
  | { id: string; role: 'user'; text: string; mode: Mode; at: number }
  | {
    id: string; role: 'ai'; says: string[]; actions: ActionView[]; cards: Card[]; busy: boolean; error?: string; at: number; retry?: { text: string; mode: Mode };
    /** The step being written now: the model's reasoning and its reply so far. */
    live?: { reasoning: string; text: string };
    /** Each finished step's reasoning, where the model showed any. */
    reasoning?: string[];
  };

/** Reasoning kept per step: the end of a long one is what led to the answer. */
const REASONING_MAX = 6000;
const tail = (s: string, n: number) => (s.length > n ? `…${s.slice(-n)}` : s);

/** A streamed step: the model's deltas as they come, then the step, read off the server's events. */
async function readStep(res: Response, onDelta: (kind: string, text: string) => void): Promise<{ say?: string; actions?: Call[]; done?: boolean }> {
  if (!res.body || !/event-stream/.test(res.headers.get('content-type') ?? '')) return (await res.json()).step;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || !data) continue;
      const body = JSON.parse(data);
      if (event === 'delta') onDelta(body.kind, body.text);
      else if (event === 'step') return body.step;
      else if (event === 'error') throw new Error(body.error || 'TI could not answer.');
    }
  }
  throw new Error('TI stopped before it answered.');
}

export interface Auth { engine: Engine; key: string }

export interface AssistDeps {
  /** The page, minus starting forecasts: those need the reader's engine and key, given per turn. */
  site: Omit<Site, 'forecast'>;
  startForecast: (question: string, depth: Depth, auth: Auth) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  forecastSummary: () => AssistContext['forecast'];
  /** Whether the workspace is open and what it shows. */
  ui?: () => AssistContext['ui'];
  /** Called with AI's final words for a turn, e.g. to read them aloud. */
  onReply?: (text: string) => void;
}

const STORE = 'takip.ai.assist';
const MAX_ENTRIES = 80;
const MAX_HISTORY = 40;

/** A turn that was mid-flight when the page went away did not finish. */
function settle(entries: Entry[]): Entry[] {
  return entries.map(e => (e.role === 'ai' && e.busy ? { ...e, busy: false, live: undefined, error: e.error ?? t('Interrupted.') } : e));
}

function load(): { entries: Entry[]; history: AssistMessage[]; chatId: string | null } {
  if (typeof window === 'undefined') return { entries: [], history: [], chatId: null };
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORE) || 'null') as { entries?: Entry[]; history?: AssistMessage[]; chatId?: string } | null;
    return { entries: settle(raw?.entries ?? []), history: raw?.history ?? [], chatId: raw?.chatId ?? null };
  } catch {
    return { entries: [], history: [], chatId: null };
  }
}

function save(entries: Entry[], history: AssistMessage[], chatId: string) {
  try { sessionStorage.setItem(STORE, JSON.stringify({ entries: entries.slice(-MAX_ENTRIES), history: history.slice(-MAX_HISTORY), chatId })); } catch { /* storage full or blocked */ }
}

let seq = 0;
const nextId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function useAssist(deps: AssistDeps) {
  const [initial] = useState(() => { const l = load(); return { ...l, chatId: l.chatId ?? nextId() }; });
  const [entries, setEntries] = useState<Entry[]>(initial.entries);
  const [busy, setBusy] = useState(false);
  /** The kept chat the conversation on screen belongs to. */
  const [chatId, setChatId] = useState(initial.chatId);
  const history = useRef<AssistMessage[]>(initial.history);
  const chatIdRef = useRef(initial.chatId);
  const abort = useRef<AbortController | null>(null);
  const depsRef = useRef(deps);
  useEffect(() => { depsRef.current = deps; });
  useEffect(() => { save(entries, history.current, chatIdRef.current); }, [entries]);

  /** Keeps the open chat in the kept list: the whole conversation, titled and timed. */
  const archive = useCallback((id: string, list: Entry[], log: AssistMessage[]) => {
    if (!hasContent(list)) return;
    upsertChat({ id, title: titleOf(list), at: list[0]?.at ?? Date.now(), updatedAt: Date.now(), entries: settle(list).slice(-MAX_ENTRIES), history: log.slice(-MAX_HISTORY) });
  }, []);
  const assignChat = useCallback((id: string) => { chatIdRef.current = id; setChatId(id); }, []);

  /** What is on screen, for the model. The server stamps the time and checks the rest. */
  const context = useCallback((): AssistContext => {
    const { site, forecastSummary } = depsRef.current;
    const v = site.view();
    const layers = site.layers();
    const d = site.data();
    const t = site.tracked?.();
    const trackedName = t ? FIND_LAYERS.filter(l => ['flights', 'military_flights', 'ships', 'satellites'].includes(l))
      .flatMap(l => SOURCES[l].keys.flatMap(k => (Array.isArray(d[k]) ? d[k] as Record<string, unknown>[] : [])))
      .find(r => [r.icao24, r.mmsi, r.noradId].some(x => x !== undefined && String(x).toLowerCase() === t.id.toLowerCase())) : undefined;
    return {
      now: '',
      view: { lat: v.lat, lng: v.lng, zoom: v.zoom, projection: v.projection, style: v.style, pitch: v.pitch, bearing: v.bearing },
      layersOn: Object.keys(LAYERS).filter(k => layers[k]),
      loaded: Object.fromEntries(FIND_LAYERS.map(l => [l, SOURCES[l].keys.reduce((n, k) => n + (Array.isArray(d[k]) ? (d[k] as unknown[]).length : 0), 0)])),
      feeds: feedProblems(FIND_LAYERS, { data: d, layersOn: layers, marks: feedMarks() }),
      tracked: t ? { ...t, ...(trackedName ? { name: String(trackedName.callsign ?? trackedName.name ?? '').trim() || undefined } : {}) } : null,
      forecast: forecastSummary(),
      ui: depsRef.current.ui?.(),
    };
  }, []);

  const send = useCallback(async (text: string, mode: Mode, auth: Auth) => {
    const said = text.trim();
    if (!said || abort.current) return;
    countAction('ti.ask');
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    const aiId = nextId();
    const userEntry: Entry = { id: nextId(), role: 'user', text: said, mode, at: Date.now() };
    setEntries(e => {
      const next: Entry[] = [...e, userEntry, { id: aiId, role: 'ai', says: [], actions: [], cards: [], busy: true, at: Date.now() }];
      archive(chatIdRef.current, next, history.current); // the reader's line survives a mid-turn close
      return next;
    });
    const patch = (f: (e: Extract<Entry, { role: 'ai' }>) => Extract<Entry, { role: 'ai' }>) =>
      setEntries(list => list.map(e => (e.id === aiId && e.role === 'ai' ? f(e) : e)));

    // Where each step's actions start in the entry's list.
    const base: number[] = [];
    let actionsSoFar = 0;
    let finalSay = '';
    const site: Site = {
      ...depsRef.current.site,
      forecast: (q, d) => (asksForForecast(said, mode)
        ? depsRef.current.startForecast(q, d, auth)
        : Promise.resolve({ ok: false as const, error: 'A forecast starts only when you ask for one: say "forecast…", or pick Forecast mode' })),
    };

    try {
      history.current = await converse(history.current, said, mode, {
        signal: ctrl.signal,
        context,
        step: async (messages, ctx, signal) => {
          patch(e => ({ ...e, live: { reasoning: '', text: '' } }));
          const res = await fetch('/api/ai/assist', { method: 'POST', headers: headersFor(auth.engine, auth.key), body: JSON.stringify({ messages, context: ctx, stream: true }), signal });
          if (!res.ok) throw new Error(await errorOf(res));
          // Many small pieces arrive; the conversation redraws a few times a second at most.
          let pending: { reasoning: string; text: string; reset: boolean } = { reasoning: '', text: '', reset: false };
          let timer: ReturnType<typeof setTimeout> | null = null;
          const flush = () => {
            timer = null;
            const p = pending;
            pending = { reasoning: '', text: '', reset: false };
            patch(e => {
              const was = p.reset ? { reasoning: '', text: '' } : e.live ?? { reasoning: '', text: '' };
              return { ...e, live: { reasoning: tail(was.reasoning + p.reasoning, REASONING_MAX), text: was.text + p.text } };
            });
          };
          let step: { say?: string; actions?: Call[]; done?: boolean };
          try {
            step = await readStep(res, (kind, text) => {
              if (kind === 'reset') pending = { reasoning: '', text: '', reset: true };
              else if (kind === 'reasoning') pending.reasoning += text;
              else if (kind === 'text') pending.text += text;
              timer ??= setTimeout(flush, 120);
            });
          } finally {
            if (timer) clearTimeout(timer);
            flush();
          }
          patch(e => ({ ...e, live: undefined, reasoning: e.live?.reasoning.trim() ? [...(e.reasoning ?? []), e.live.reasoning.trim()] : e.reasoning }));
          return { say: step.say ?? '', calls: Array.isArray(step.actions) ? step.actions : [], done: step.done !== false };
        },
        exec: (call, signal) => runCall(call, site, signal),
        onProgress: p => {
          if (p.type === 'step') {
            base[p.step] = actionsSoFar;
            actionsSoFar += p.calls.length;
            if (p.say) finalSay = p.say;
            patch(e => ({
              ...e,
              says: p.say ? [...e.says, p.say] : e.says,
              actions: [...e.actions, ...p.calls.map((c, j) => ({ tool: c.tool, args: c.args, status: (j === 0 ? 'running' : 'pending') as ActionView['status'] }))],
            }));
          } else {
            const idx = base[p.step] + p.call;
            patch(e => ({
              ...e,
              actions: e.actions.map((a, k) => (k === idx ? { ...a, status: p.outcome.result.ok ? 'ok' : 'error', summary: p.outcome.result.summary } : k === idx + 1 && a.status === 'pending' ? { ...a, status: 'running' } : a)),
              cards: p.outcome.card ? [...e.cards, p.outcome.card] : e.cards,
            }));
          }
        },
      });
      patch(e => ({ ...e, busy: false, live: undefined, actions: e.actions.map(a => (a.status === 'running' || a.status === 'pending' ? { ...a, status: ctrl.signal.aborted ? 'error' : a.status, summary: a.summary ?? (ctrl.signal.aborted ? t('Stopped') : undefined) } : a)) }));
      if (finalSay && !ctrl.signal.aborted) depsRef.current.onReply?.(finalSay);
    } catch (err) {
      const message = ctrl.signal.aborted ? t('Stopped.') : err instanceof Error ? err.message : t('TI could not answer.');
      patch(e => ({ ...e, busy: false, live: undefined, error: message, retry: ctrl.signal.aborted ? undefined : { text: said, mode }, actions: e.actions.map(a => (a.status === 'running' || a.status === 'pending' ? { ...a, status: 'error' } : a)) }));
    } finally {
      abort.current = null;
      setBusy(false);
      setEntries(list => { archive(chatIdRef.current, list, history.current); return list; });
    }
  }, [context, archive]);

  const stop = useCallback(() => { abort.current?.abort(); }, []);

  /** New conversation: the old one is already kept, so start a fresh chat. */
  const clear = useCallback(() => {
    abort.current?.abort();
    const oldId = chatIdRef.current, oldLog = history.current;
    history.current = [];
    assignChat(nextId());
    depsRef.current.site.highlight(null);
    setEntries(list => { archive(oldId, list, oldLog); return []; });
  }, [archive, assignChat]);

  /** Reopen a kept chat: keep the current one first, then load it in. */
  const openChat = useCallback((id: string) => {
    if (id === chatIdRef.current) return;
    const chat = loadChats().find(c => c.id === id);
    if (!chat) return;
    abort.current?.abort();
    const oldId = chatIdRef.current, oldLog = history.current;
    history.current = chat.history;
    assignChat(id);
    depsRef.current.site.highlight(null);
    setEntries(list => { archive(oldId, list, oldLog); return settle(chat.entries); });
  }, [archive, assignChat]);

  const deleteChat = useCallback((id: string) => {
    removeChat(id);
    if (id !== chatIdRef.current) return;
    // The open chat went: clear the screen without keeping it again.
    abort.current?.abort();
    history.current = [];
    assignChat(nextId());
    depsRef.current.site.highlight(null);
    setEntries([]);
  }, [assignChat]);

  /**
   * A spoken turn, fed by the live voice session: the reader's words once transcribed, then each
   * tool TI calls and what it says, kept in the same conversation (and history) as typed turns.
   */
  const spoken = useRef<{ aiId: string; userId: string; heard: string; calls: Call[]; results: Outcome['result'][] } | null>(null);
  const voice = useMemo(() => {
    const patchAi = (f: (e: Extract<Entry, { role: 'ai' }>) => Extract<Entry, { role: 'ai' }>) => {
      const id = spoken.current?.aiId;
      if (id) setEntries(list => list.map(e => (e.id === id && e.role === 'ai' ? f(e) : e)));
    };
    const flushCalls = () => {
      const t = spoken.current;
      if (!t || !t.calls.length) return;
      history.current = [...history.current, { role: 'assistant', say: '', calls: t.calls }, { role: 'tool', results: t.results }];
      t.calls = [];
      t.results = [];
    };
    return {
      begin() {
        if (spoken.current) return;
        const t = { aiId: nextId(), userId: nextId(), heard: '', calls: [], results: [] };
        spoken.current = t;
        setEntries(e => [...e, { id: t.userId, role: 'user', text: '…', mode: 'auto', at: Date.now() }, { id: t.aiId, role: 'ai', says: [], actions: [], cards: [], busy: true, at: Date.now() }]);
      },
      heard(text: string) {
        const t = spoken.current;
        if (!t) return;
        t.heard = text;
        history.current = [...history.current, { role: 'user', text, mode: 'auto' }];
        setEntries(list => {
          const next = list.map(e => (e.id === t.userId && e.role === 'user' ? { ...e, text } : e));
          archive(chatIdRef.current, next, history.current);
          return next;
        });
      },
      /** Runs one tool the voice model called, shown like a typed turn's action. */
      async call(call: Call, auth: Auth): Promise<Outcome> {
        const t = spoken.current;
        // The transcript can trail the model's call; the forecast guard needs the words.
        if (call.tool === 'forecast') for (let i = 0; i < 20 && t && !t.heard; i++) await new Promise(r => setTimeout(r, 100));
        let idx = -1;
        patchAi(e => { idx = e.actions.length; return { ...e, actions: [...e.actions, { tool: call.tool, args: call.args, status: 'running' }] }; });
        const site: Site = {
          ...depsRef.current.site,
          forecast: (q, d) => (asksForForecast(t?.heard ?? '', 'auto')
            ? depsRef.current.startForecast(q, d, auth)
            : Promise.resolve({ ok: false as const, error: 'A forecast starts only when the reader asks for one' })),
        };
        let outcome: Outcome;
        try {
          outcome = await runCall(call, site);
        } catch (err) {
          outcome = { result: { tool: call.tool, ok: false, summary: err instanceof Error ? err.message : 'failed' } };
        }
        patchAi(e => ({
          ...e,
          actions: e.actions.map((a, k) => (k === idx ? { ...a, status: outcome.result.ok ? 'ok' : 'error', summary: outcome.result.summary } : a)),
          cards: outcome.card ? [...e.cards, outcome.card] : e.cards,
        }));
        if (t) { t.calls.push(call); t.results.push(outcome.result); }
        return outcome;
      },
      said(text: string) {
        flushCalls();
        patchAi(e => ({ ...e, says: [...e.says, text] }));
        history.current = [...history.current, { role: 'assistant', say: text, calls: [] }];
      },
      end(error?: string) {
        const turn = spoken.current;
        if (!turn) return;
        flushCalls();
        if (!turn.heard) setEntries(list => list.map(e => (e.id === turn.userId && e.role === 'user' ? { ...e, text: '(spoken)' } : e)));
        patchAi(e => ({ ...e, busy: false, ...(error ? { error } : {}), actions: e.actions.map(a => (a.status === 'running' ? { ...a, status: 'error', summary: a.summary ?? t('Stopped') } : a)) }));
        spoken.current = null;
        setEntries(list => { archive(chatIdRef.current, list, history.current); return list; });
      },
    };
  }, [archive]);

  return { entries, busy, chatId, send, stop, clear, openChat, deleteChat, context, voice };
}

export type AssistClient = ReturnType<typeof useAssist>;
