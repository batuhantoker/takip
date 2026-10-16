import { describe, expect, it } from 'vitest';
import { migrateStorage } from './storage-migration';

function memory(entries: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

describe('migrateStorage', () => {
  it('moves every takip.oi.* key in both stores and leaves the rest alone', () => {
    const local = memory({ 'takip.oi.engine': '{"provider":"local"}', 'takip.oi.key.openai': 'sk-x', 'takip.layers': '{}' });
    const session = memory({ 'takip.oi.tokens': '{"r":"t"}', 'takip.oi.assist.draft': '{"text":"hi"}' });
    expect(migrateStorage([local, session])).toBe(4);
    expect(local.getItem('takip.ai.engine')).toBe('{"provider":"local"}');
    expect(local.getItem('takip.ai.key.openai')).toBe('sk-x');
    expect(session.getItem('takip.ai.tokens')).toBe('{"r":"t"}');
    expect(session.getItem('takip.ai.assist.draft')).toBe('{"text":"hi"}');
    expect([local.getItem('takip.oi.engine'), session.getItem('takip.oi.tokens')]).toEqual([null, null]);
    expect(local.getItem('takip.layers')).toBe('{}');
  });

  it('turns kept chat turns from role "oi" into "ai"', () => {
    const local = memory({ 'takip.oi.chats': JSON.stringify([{ id: 'c', entries: [{ role: 'user', text: 'q' }, { role: 'oi', says: ['a'] }] }]) });
    migrateStorage([local]);
    expect(JSON.parse(local.getItem('takip.ai.chats')!)[0].entries.map((e: { role: string }) => e.role)).toEqual(['user', 'ai']);
  });

  it('keeps a value already under the new name, drops the old, and runs once', () => {
    const local = memory({ 'takip.oi.voice': '1', 'takip.ai.voice': '0' });
    expect(migrateStorage([local])).toBe(0);
    expect(local.getItem('takip.ai.voice')).toBe('0');
    expect(local.getItem('takip.oi.voice')).toBeNull();
    expect(migrateStorage([local, null, undefined])).toBe(0);
  });
});
