'use client';
/** TAKIP TI: the Assist chats this browser has kept — search, reopen, delete. */
import { useMemo, useState } from 'react';
import { History, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { useT } from '@/components/ui/use-t';
import { ScrollBody } from '../parts/scroll-body';
import { ago } from '../theme';
import { loadChats, type SavedChat } from './chat-store';

/** Everything the reader said, plus the title, for the search box to read. */
function haystack(c: SavedChat): string {
  return [c.title, ...c.entries.flatMap(e => (e.role === 'user' ? [e.text] : e.says))].join(' ').toLowerCase();
}

/** The last real line of the chat, for a second line under the title. */
function preview(c: SavedChat): string {
  for (let i = c.entries.length - 1; i >= 0; i--) {
    const e = c.entries[i];
    const line = (e.role === 'user' ? e.text : e.says[e.says.length - 1] ?? '').trim();
    if (line && line !== '…' && line !== '(spoken)' && line !== c.title) return line;
  }
  return '';
}

export function ChatHistory({ currentId, onOpen, onDelete, embedded }: {
  currentId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** In the phone drawer, which scrolls as a whole. */
  embedded?: boolean;
}) {
  const t = useT();
  const [chats, setChats] = useState(loadChats);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => (needle ? chats.filter(c => haystack(c).includes(needle)) : chats), [chats, needle]);

  const remove = (id: string) => { onDelete(id); setChats(cs => cs.filter(c => c.id !== id)); };

  const list = chats.length === 0 ? (
    <EmptyState icon={History} title={t('No saved chats yet')} body={t('Your conversations with TI are kept here, ready to reopen.')} />
  ) : rows.length === 0 ? (
    <EmptyState icon={History} title={t('Nothing matches')} body={t('No chat mentions “{query}”.', { query: q.trim() })} />
  ) : (
    <div>
      {rows.map(c => (
        <ListRow key={c.id} title={c.title === 'Untitled chat' ? t('Untitled chat') : c.title} selected={c.id === currentId} meta={ago(c.updatedAt, t)} subtitle={preview(c) || undefined}
          onClick={() => onOpen(c.id)}
          trailing={<IconButton size="sm" label={t('Delete chat')} icon={X} onClick={() => remove(c.id)} className="-mr-1 text-ink-4 group-hover/row:text-ink-2" />} />
      ))}
    </div>
  );

  const search = <SearchField value={q} onChange={setQ} placeholder={t('Search chats')} autoFocus={!embedded} />;

  if (embedded) return <div className="flex flex-col gap-3 px-4 pb-4">{search}{list}</div>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-3 pb-2">{search}</div>
      <ScrollBody>{list}</ScrollBody>
    </div>
  );
}
