'use client';
/**
 * TAKIP TI Assist: a live spoken conversation with TI over OpenAI Realtime.
 *
 * The page asks /api/ai/voice for a short-lived secret (minted with the reader's OpenAI key, which
 * stays on the server), opens WebRTC to OpenAI with the microphone, plays TI's voice, and runs each
 * tool TI calls on the map as a typed turn would, sending the result back. Each turn asks for its
 * response itself, with what is on screen now. Audio goes to OpenAI on the reader's own key.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorOf, headersFor } from '@/lib/ai/client';
import { REALTIME_CALLS, callIn, heardIn, saidIn, voiceInstructions } from '@/lib/ai/assist/live-voice';
import { TOOL_NAMES, type Call, type ToolName } from '@/lib/ai/assist/protocol';
import type { AssistClient, Auth } from './use-assist';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

/** Tool rounds one spoken turn may take, like a typed turn's steps. */
const MAX_ROUNDS = 5;

const isTool = (n: string): n is ToolName => (TOOL_NAMES as readonly string[]).includes(n);

export function useLiveVoice(assist: AssistClient, auth: Auth | null) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState('');
  const live = useRef<{ pc: RTCPeerConnection; dc: RTCDataChannel; mic: MediaStream; audio: HTMLAudioElement } | null>(null);
  const turn = useRef<{ rounds: number; queue: Promise<void>; calls: number; seen: Set<string> } | null>(null);
  const assistRef = useRef(assist);
  const authRef = useRef(auth);
  useEffect(() => { assistRef.current = assist; authRef.current = auth; });

  const available = auth?.engine.provider === 'openai' && Boolean(auth.key) && typeof window !== 'undefined' && 'RTCPeerConnection' in window && Boolean(navigator.mediaDevices?.getUserMedia);

  const send = (event: Record<string, unknown>) => {
    const dc = live.current?.dc;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(event));
  };
  const respond = () => send({ type: 'response.create', response: { instructions: voiceInstructions(assistRef.current.context()) } });

  const teardown = useCallback(() => {
    const l = live.current;
    live.current = null;
    if (!l) return;
    try { l.dc.close(); } catch { /* already closed */ }
    try { l.pc.close(); } catch { /* already closed */ }
    l.mic.getTracks().forEach(t => t.stop());
    l.audio.srcObject = null;
    l.audio.remove();
  }, []);

  const stop = useCallback(() => {
    teardown();
    turn.current = null;
    assistRef.current.voice.end();
    setState('idle');
  }, [teardown]);

  useEffect(() => () => { teardown(); }, [teardown]);

  const onEvent = useCallback((e: Record<string, unknown>) => {
    const v = assistRef.current.voice;
    switch (e.type) {
      case 'input_audio_buffer.speech_started':
        setState('listening');
        return;
      case 'input_audio_buffer.committed':
        // A new question: what was still running is over.
        if (turn.current) v.end();
        v.begin();
        turn.current = { rounds: 0, queue: Promise.resolve(), calls: 0, seen: new Set() };
        setState('thinking');
        respond();
        return;
      case 'output_audio_buffer.started':
        setState('speaking');
        return;
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        setState(s => (s === 'speaking' ? 'listening' : s));
        return;
      case 'error': {
        const msg = (e.error as { message?: string } | undefined)?.message ?? 'Live voice error';
        // Asking for a response while one is still running is harmless; the turn goes on.
        if (/active response/i.test(msg)) return;
        setError(msg);
        v.end(msg);
        turn.current = null;
        return;
      }
      case 'response.done': {
        const t = turn.current;
        if (!t) return;
        const status = (e.response as { status?: string } | undefined)?.status;
        if (status === 'cancelled') { v.end(); turn.current = null; return; }
        if (!t.calls) { v.end(); turn.current = null; setState(s => (s === 'thinking' ? 'listening' : s)); return; }
        // The tools this response called answer first; then TI speaks from their results.
        t.calls = 0;
        void t.queue.then(() => {
          if (turn.current !== t) return;
          if (++t.rounds >= MAX_ROUNDS) { v.end(); turn.current = null; return; }
          respond();
        });
        return;
      }
    }
    const heard = heardIn(e);
    if (heard) { v.heard(heard); return; }
    const said = saidIn(e);
    if (said) { v.said(said); return; }
    const call = callIn(e);
    if (call && turn.current && !turn.current.seen.has(call.callId)) {
      const t = turn.current;
      t.seen.add(call.callId);
      t.calls++;
      // In order: the map should do what was asked in the order it was asked.
      t.queue = t.queue.then(async () => {
        const a = authRef.current;
        const result = isTool(call.name) && a
          ? (await v.call({ tool: call.name, args: call.args } as Call, a)).result
          : { tool: call.name, ok: false, summary: `No tool called ${call.name}` };
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.callId, output: JSON.stringify({ ok: result.ok, summary: result.summary, ...('data' in result && result.data !== undefined ? { data: result.data } : {}) }).slice(0, 12_000) } });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async () => {
    const a = authRef.current;
    if (live.current || !a) return;
    setError('');
    setState('connecting');
    let mic: MediaStream | null = null;
    let pc: RTCPeerConnection | null = null;
    try {
      const res = await fetch('/api/ai/voice', { method: 'POST', headers: headersFor(a.engine, a.key), body: JSON.stringify({ context: assistRef.current.context() }) });
      if (!res.ok) throw new Error(await errorOf(res));
      const { value } = await res.json() as { value: string };
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      pc = new RTCPeerConnection();
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.hidden = true;
      document.body.appendChild(audio);
      pc.ontrack = ev => { audio.srcObject = ev.streams[0]; };
      mic.getTracks().forEach(t => pc!.addTrack(t, mic!));
      const dc = pc.createDataChannel('oai-events');
      dc.addEventListener('message', ev => { try { onEvent(JSON.parse(String(ev.data))); } catch { /* not an event */ } });
      dc.addEventListener('open', () => setState('listening'));
      dc.addEventListener('close', () => { if (live.current?.dc === dc) stop(); });
      pc.addEventListener('connectionstatechange', () => { if (pc?.connectionState === 'failed') { setError('The voice connection dropped.'); stop(); setState('error'); } });
      live.current = { pc, dc, mic, audio };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const answer = await fetch(REALTIME_CALLS, { method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/sdp' } });
      if (!answer.ok) throw new Error(`OpenAI refused the voice call (${answer.status}).`);
      await pc.setRemoteDescription({ type: 'answer', sdp: await answer.text() });
    } catch (err) {
      if (!live.current) { mic?.getTracks().forEach(t => t.stop()); pc?.close(); }
      teardown();
      setError(err instanceof Error ? (err.name === 'NotAllowedError' ? 'Microphone permission was refused.' : err.message) : 'Live voice could not start.');
      setState('error');
    }
  }, [onEvent, stop, teardown]);

  return { available, state, error, start, stop };
}

export type LiveVoice = ReturnType<typeof useLiveVoice>;
