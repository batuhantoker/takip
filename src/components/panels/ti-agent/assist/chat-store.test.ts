import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasContent, loadChats, removeChat, titleOf, upsertChat, type SavedChat } from './chat-store';
import type { Entry } from './use-assist';

/** A localStorage that optionally refuses writes over a byte budget, to force the quota path. */
function fakeStorage(limit = Infinity) {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { if (v.length > limit) throw new Error('QuotaExceededError'); m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

function stub(limit = Infinity) {
  vi.stubGlobal('window', { localStorage: fakeStorage(limit) });
}

const user = (text: string): Entry => ({ id: `u${Math.random()}`, role: 'user', text, mode: 'auto', at: 1 });
const ai = (say: string): Entry => ({ id: `o${Math.random()}`, role: 'ai', says: [say], actions: [], cards: [], busy: false, at: 2 });
const chat = (id: string, updatedAt: number, entries: Entry[]): SavedChat => ({ id, title: titleOf(entries), at: entries[0]?.at ?? 0, updatedAt, entries, history: [] });

afterEach(() => vi.unstubAllGlobals());

describe('titleOf', () => {
  it('takes the first real user line', () => {
    expect(titleOf([ai('hi'), user('Ships in the strait'), user('later')])).toBe('Ships in the strait');
  });
  it('skips placeholder lines and falls back', () => {
    expect(titleOf([user('…'), user('(spoken)')])).toBe('Untitled chat');
    expect(titleOf([])).toBe('Untitled chat');
  });
  it('truncates a long first line', () => {
    const t = titleOf([user('x'.repeat(200))]);
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBeLessThanOrEqual(81);
  });
});

describe('hasContent', () => {
  it('needs a real user line', () => {
    expect(hasContent([ai('hi')])).toBe(false);
    expect(hasContent([user('…')])).toBe(false);
    expect(hasContent([user('what is this')])).toBe(true);
  });
});

describe('upsert / load / remove', () => {
  beforeEach(() => stub());

  it('keeps chats newest-updated first', () => {
    upsertChat(chat('a', 10, [user('a')]));
    upsertChat(chat('b', 30, [user('b')]));
    upsertChat(chat('c', 20, [user('c')]));
    expect(loadChats().map(c => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('replaces a chat in place by id', () => {
    upsertChat(chat('a', 10, [user('first')]));
    upsertChat(chat('a', 40, [user('first'), user('more')]));
    const all = loadChats();
    expect(all).toHaveLength(1);
    expect(all[0].updatedAt).toBe(40);
  });

  it('caps the list at 30, dropping the oldest', () => {
    for (let i = 0; i < 35; i++) upsertChat(chat(`c${i}`, i, [user(`q${i}`)]));
    const all = loadChats();
    expect(all).toHaveLength(30);
    expect(all[0].id).toBe('c34');
    expect(all.some(c => c.id === 'c0')).toBe(false);
  });

  it('removes one chat', () => {
    upsertChat(chat('a', 10, [user('a')]));
    upsertChat(chat('b', 20, [user('b')]));
    removeChat('a');
    expect(loadChats().map(c => c.id)).toEqual(['b']);
  });
});

describe('quota', () => {
  it('drops the oldest until the newest fits', () => {
    // Each chat serialises to well over 400 bytes, so only a couple fit at once.
    stub(1200);
    for (let i = 0; i < 5; i++) upsertChat(chat(`c${i}`, i, [user('x'.repeat(400))]));
    const all = loadChats();
    expect(all.length).toBeGreaterThan(0);
    expect(all.length).toBeLessThan(5);
    expect(all[0].id).toBe('c4'); // the newest always survives
    expect(all.some(c => c.id === 'c0')).toBe(false);
  });
});
