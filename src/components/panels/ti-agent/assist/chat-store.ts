'use client';
/**
 * TAKIP TI: the Assist chats this browser has kept.
 *
 * Each chat is a whole conversation — what showed on screen and the model's own
 * log — saved to localStorage so it outlives the tab (the live chat in
 * use-assist only sits in sessionStorage). The panel lists them to reopen,
 * search and delete.
 */
import type { AssistMessage } from '@/lib/ai/assist/protocol';
import type { Entry } from './use-assist';

export interface SavedChat {
  id: string;
  title: string;
  /** When it began (the first message). */
  at: number;
  /** When it last changed. */
  updatedAt: number;
  entries: Entry[];
  history: AssistMessage[];
}

const STORE = 'takip.ai.chats';
const MAX_CHATS = 30;

function read(): SavedChat[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE) || '[]');
    return Array.isArray(raw)
      ? raw.filter((c): c is SavedChat => c && typeof c.id === 'string' && Array.isArray(c.entries) && Array.isArray(c.history))
      : [];
  } catch {
    return [];
  }
}

function write(chats: SavedChat[]): boolean {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(chats));
    return true;
  } catch {
    return false;
  }
}

/** Every kept chat, newest change first. */
export function loadChats(): SavedChat[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The first thing the reader typed, trimmed to a title. */
export function titleOf(entries: Entry[]): string {
  const first = entries.find(e => e.role === 'user' && e.text.trim() && e.text !== '…' && e.text !== '(spoken)');
  const text = first && first.role === 'user' ? first.text.trim() : '';
  if (!text) return 'Untitled chat';
  return text.length > 80 ? `${text.slice(0, 80).trimEnd()}…` : text;
}

/** Whether a chat is worth keeping: at least one real thing the reader said. */
export function hasContent(entries: Entry[]): boolean {
  return entries.some(e => e.role === 'user' && e.text.trim() && e.text !== '…');
}

/** Saves (or replaces) one chat. Oldest drop past the cap, or one at a time if the store is full. */
export function upsertChat(chat: SavedChat): void {
  const rest = read().filter(c => c.id !== chat.id);
  let next = [chat, ...rest].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
  while (!write(next) && next.length > 1) next = next.slice(0, -1);
}

export function removeChat(id: string): void {
  write(read().filter(c => c.id !== id));
}
