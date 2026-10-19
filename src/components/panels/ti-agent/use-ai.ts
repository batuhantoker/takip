'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorOf, headersFor, HISTORY_CAP, loadHistory, runToken, saveHistory, saveRunToken, setUrlRun, type Engine, type HistoryEntry, type StartInput } from '@/lib/ai/client';
import { applyEvent, currentAnswer, currentProbability, initialState, type RunState } from '@/lib/ai/state';
import type { Stamped } from '@/lib/ai/types';
import { countAction } from '@/lib/platform/usage-actions';

/**
 * The run the visitor is watching, followed over Server-Sent Events and folded
 * with the same applyEvent the server uses, their history, and the calls that
 * start, steer and question a run.
 */
export function useAi() {
  const [state, setState] = useState<RunState | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Read from this browser on the first client render; the server has no storage and renders none.
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [token, setToken] = useState<string | null>(null);
  const source = useRef<EventSource | null>(null);
  const queue = useRef<Stamped[]>([]);
  const frame = useRef(0);
  /** The run as folded so far, and whose it is: the stream handler reads these outside React's render. */
  const latest = useRef<RunState | null>(null);
  const following = useRef<string | null>(null);

  /** Keeps the history entry in step with how a run ended. */
  const record = useCallback((id: string, s: RunState) => {
    const probability = currentProbability(s);
    const answer = currentAnswer(s) || undefined;
    setHistory(h => {
      const i = h.findIndex(x => x.id === id);
      if (i < 0 || (h[i].status === s.status && h[i].probability === probability && h[i].answer === answer)) return h;
      const next = h.slice();
      next[i] = { ...h[i], status: s.status, probability, answer };
      saveHistory(next);
      return next;
    });
  }, []);

  const flush = useCallback(() => {
    frame.current = 0;
    const events = queue.current.splice(0);
    if (!events.length) return;
    const next = events.reduce(applyEvent, latest.current ?? initialState());
    latest.current = next;
    setState(next);
    if (following.current && next.status !== 'running') record(following.current, next);
  }, [record]);

  const close = useCallback(() => {
    source.current?.close();
    source.current = null;
    queue.current = [];
    if (frame.current) clearTimeout(frame.current);
    frame.current = 0;
  }, []);

  useEffect(() => close, [close]);

  /** Follows a run: replays it from the start, then live. False when it is gone. */
  const watch = useCallback(async (id: string): Promise<boolean> => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
    close();
    latest.current = null;
    following.current = id;
    setError('');
    setState(null);
    setRunId(id);
    setToken(runToken(id));
    const res = await fetch(`/api/ai/runs/${id}`, { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) {
      setError(res?.status === 404 ? 'That forecast has expired. Runs are kept for a few hours.' : 'Could not reach TI.');
      setRunId(null);
      setUrlRun(null);
      return false;
    }
    setUrlRun(id);
    const es = new EventSource(`/api/ai/runs/${id}/events`);
    source.current = es;
    es.onmessage = m => {
      let e: Stamped;
      try { e = JSON.parse(m.data); } catch { return; }
      queue.current.push(e);
      // The run is over: stop here, or the browser would reconnect when the server closes the stream.
      if (e.t === 'end') { es.close(); if (source.current === es) source.current = null; }
      // One render per short beat, however fast events arrive (a replay sends hundreds at once).
      // A timer, not an animation frame: frames stop while the tab is hidden, and a run must keep
      // up when its watcher switches tabs.
      if (!frame.current) frame.current = window.setTimeout(flush, 60);
    };
    // A dropped connection reconnects by itself and resumes from the last event it saw. One the
    // server refused outright (too many streams, a run gone) does not: say so rather than sit silent.
    es.onerror = () => {
      if (es.readyState !== EventSource.CLOSED || source.current !== es) return;
      source.current = null;
      setError('Lost the live stream of this run. Reopen it from your forecasts to catch up.');
    };
    return true;
  }, [close, flush]);

  const start = useCallback(async (input: StartInput, engine: Engine, key: string): Promise<string | null> => {
    countAction('ti.ask');
    setError('');
    let res: Response;
    try {
      res = await fetch('/api/ai/runs', {
        method: 'POST',
        headers: headersFor(engine, key),
        body: JSON.stringify({ question: input.question, seed: input.seed, seed_scope: input.seedScope, depth: input.depth, use_feeds: input.useFeeds }),
      });
    } catch {
      setError('Could not reach TI.');
      return null;
    }
    if (!res.ok) { setError(await errorOf(res)); return null; }
    const body = await res.json();
    saveRunToken(body.id, body.run_token);
    const entry: HistoryEntry = { id: body.id, question: input.question, at: Date.now(), probability: null, status: 'running', provider: engine.provider, model: engine.model };
    setHistory(h => {
      const next = [entry, ...h.filter(x => x.id !== body.id)].slice(0, HISTORY_CAP);
      saveHistory(next);
      return next;
    });
    await watch(body.id);
    return body.id;
  }, [watch]);

  const cancel = useCallback(async () => {
    if (!runId || !token) return;
    await fetch(`/api/ai/runs/${runId}`, { method: 'DELETE', headers: { 'x-ai-run-token': token } }).catch(() => null);
  }, [runId, token]);

  const inject = useCallback(async (text: string): Promise<string | null> => {
    if (!runId || !token) return 'Only the browser that started this run can steer it.';
    const res = await fetch(`/api/ai/runs/${runId}/inject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ai-run-token': token },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    if (!res) return 'Could not reach TI.';
    return res.ok ? null : errorOf(res);
  }, [runId, token]);

  const ask = useCallback(async (target: string, message: string, engine: Engine, key: string): Promise<{ reply?: string; error?: string }> => {
    if (!runId) return { error: 'No run.' };
    countAction('ti.ask');
    const res = await fetch(`/api/ai/runs/${runId}/ask`, {
      method: 'POST',
      headers: headersFor(engine, key),
      body: JSON.stringify({ target, message }),
    }).catch(() => null);
    if (!res) return { error: 'Could not reach TI.' };
    if (!res.ok) return { error: await errorOf(res) };
    return { reply: (await res.json()).reply };
  }, [runId]);

  const clear = useCallback(() => {
    close();
    latest.current = null;
    following.current = null;
    setState(null);
    setRunId(null);
    setToken(null);
    setError('');
    setUrlRun(null);
  }, [close]);

  const forget = useCallback((id: string) => {
    setHistory(h => {
      const next = h.filter(x => x.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  return { state, runId, error, setError, history, canSteer: Boolean(token), start, watch, cancel, inject, ask, clear, forget };
}

export type AiClient = ReturnType<typeof useAi>;
