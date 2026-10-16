import { describe, expect, it, vi } from 'vitest';
import { REALTIME_SECRETS, callIn, heardIn, mintVoiceSession, saidIn, voiceModel, voiceSessionConfig } from './live-voice';
import { sanitizeContext } from './protocol';

describe('live voice', () => {
  it('gives the realtime model TI\'s own tools and where the reader is', () => {
    const cfg = voiceSessionConfig({ context: sanitizeContext({ view: { lat: 41, lng: 29, zoom: 8 }, layersOn: ['flights'] }) });
    const names = cfg.session.tools.map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(['go_to', 'find', 'track', 'weather', 'move', 'timeline']));
    expect(cfg.session.tools.every(t => t.type === 'function' && t.parameters.type === 'object')).toBe(true);
    expect(cfg.session.instructions).toMatch(/Map: centre 41\.00, 29\.00/);
    expect(cfg.session.audio.input.turn_detection.create_response).toBe(false);
    expect(voiceModel('gpt-4o', '')).toBe('gpt-realtime-2');
    expect(voiceModel('gpt-realtime-mini', '')).toBe('gpt-realtime-mini');
  });

  it('reads tool calls, what was heard and what TI said off the event stream', () => {
    expect(callIn({ type: 'response.function_call_arguments.done', call_id: 'c1', name: 'go_to', arguments: '{"place":"Oslo"}' })).toEqual({ callId: 'c1', name: 'go_to', args: { place: 'Oslo' } });
    expect(callIn({ type: 'response.function_call_arguments.done', call_id: 'c2', name: 'scan', arguments: '{oops' })).toEqual({ callId: 'c2', name: 'scan', args: {} });
    expect(callIn({ type: 'response.done' })).toBeNull();
    expect(heardIn({ type: 'conversation.item.input_audio_transcription.completed', transcript: ' Show me Oslo ' })).toBe('Show me Oslo');
    expect(saidIn({ type: 'response.output_audio_transcript.done', transcript: 'Here is Oslo.' })).toBe('Here is Oslo.');
  });

  it('mints a session secret on the reader\'s key and says why when OpenAI refuses', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ value: 'ek_123', expires_at: 1_900_000_000 }), { status: 200 }));
    const minted = await mintVoiceSession('sk-test', { context: null }, ok as unknown as typeof fetch);
    expect(minted).toEqual({ ok: true, value: 'ek_123', expiresAt: 1_900_000_000, model: 'gpt-realtime-2' });
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(REALTIME_SECRETS);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const refused = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Incorrect API key provided' } }), { status: 401 }));
    expect(await mintVoiceSession('sk-bad', { context: null }, refused as unknown as typeof fetch)).toEqual({ ok: false, status: 401, error: 'OpenAI: Incorrect API key provided' });
  });
});
