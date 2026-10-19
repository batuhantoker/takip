'use client';
/**
 * TAKIP TI: the reader's own material for a forecast: text files dropped or
 * picked, and anything pasted. Read in the browser; only the text is sent.
 */
import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { Segmented } from '@/components/ui/segmented';
import { useT } from '@/components/ui/use-t';
import type { Translate } from '@/lib/core/i18n/translator';
import { PANEL_SEED_MAX, SEED_MAX, seedCost, type SeedScope } from '@/lib/ai/depths';
import type { Depth } from '@/lib/ai/types';
import { shortName } from '../theme';
import { TextArea } from '@/components/panels/ti-agent/parts/text-area';

export interface DataFile { id: number; name: string; text: string }

/** Text a forecast can read. A PDF or Word file has to be saved as text first. */
const TEXT_TYPES = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'log', 'xml', 'html', 'htm', 'yaml', 'yml'];
const MAX_FILES = 8;
const MAX_FILE_BYTES = 2_000_000;

export const fmtCount = (n: number) => (n < 1_000 ? `${n}` : n < 1_000_000 ? `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}k` : `${(n / 1_000_000).toFixed(1)}M`);

/** What a forecast reads: each file under its name, then anything pasted. */
export function assemble(files: DataFile[], paste: string): string {
  const parts = files.map(f => `### ${f.name}\n${f.text}`);
  if (paste.trim()) parts.push(files.length ? `### Notes\n${paste.trim()}` : paste.trim());
  return parts.join('\n\n');
}

/** A file's text, or why it cannot be read. A web page is read as its visible text, which costs far fewer tokens. */
async function readText(file: File, t: Translate): Promise<{ text: string } | { error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!TEXT_TYPES.includes(ext)) return { error: t('{file}: text files only ({types} …). Save a PDF or Word file as text first.', { file: file.name, types: TEXT_TYPES.slice(0, 7).join(', ') }) };
  if (file.size > MAX_FILE_BYTES) return { error: t('{file} is over 2 MB.', { file: file.name }) };
  let text = await file.text().catch(() => '');
  if (text.includes(String.fromCharCode(0))) return { error: t('{file} is not a text file.', { file: file.name }) };
  if (ext === 'html' || ext === 'htm') {
    // Parsed, never run: scripts and styles are dropped, the visible text kept.
    const doc = new DOMParser().parseFromString(text, 'text/html');
    doc.querySelectorAll('script, style, noscript, template').forEach(n => n.remove());
    text = doc.body?.textContent ?? '';
  }
  text = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text ? { text } : { error: t('{file} is empty.', { file: file.name }) };
}

export function YourData({ files, setFiles, paste, setPaste, scope, setScope, depth, providerName }: {
  files: DataFile[]; setFiles: (f: DataFile[]) => void;
  paste: string; setPaste: (v: string) => void;
  scope: SeedScope; setScope: (s: SeedScope) => void;
  depth: Depth; providerName: string;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const [note, setNote] = useState('');
  const [over, setOver] = useState(false);
  const chars = assemble(files, paste).length;
  const cost = seedCost(chars, depth, scope);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    const room = MAX_FILES - files.length;
    const picked = Array.from(list).slice(0, Math.max(0, room));
    const read = await Promise.all(picked.map(f => readText(f, t)));
    const added: DataFile[] = [];
    const problems: string[] = list.length > room ? [t('Up to {n} files.', { n: MAX_FILES })] : [];
    read.forEach((r, i) => {
      if ('error' in r) problems.push(r.error);
      else added.push({ id: nextId.current++, name: picked[i].name, text: r.text });
    });
    setFiles([...files, ...added]);
    setNote(problems.join(' '));
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}
        className={cx('flex items-center gap-3 rounded-card border border-dashed px-3 py-2.5 transition-colors duration-150', over ? 'border-accent bg-accent-soft' : 'border-line-strong')}>
        <Upload aria-hidden className={cx('size-4 shrink-0', over ? 'text-accent' : 'text-ink-3')} strokeWidth={1.75} />
        <span className="min-w-0 flex-1 text-small text-ink-2">
          {t.rich('{add} or drop them here', {
            add: <button type="button" onClick={() => input.current?.click()} className={cx('rounded-control font-medium text-accent hover:underline', FOCUS_RING)}>{t('Add files')}</button>,
          })}
          <span className="block text-meta text-ink-3">{t('CSV, JSON, Markdown, text, logs, web pages')}</span>
        </span>
        <input ref={input} type="file" multiple hidden accept={TEXT_TYPES.map(ext => `.${ext}`).join(',')} onChange={e => void add(e.target.files)} aria-label={t('Add data files')} />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col">
          {files.map(f => (
            <li key={f.id} className="flex h-8 items-center gap-2.5">
              <FileText aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate text-body text-ink-1" title={f.name}>{f.name}</span>
              <span className="font-mono text-meta text-ink-3 tabular-nums">{t('{chars} characters', { chars: fmtCount(f.text.length) })}</span>
              <IconButton size="sm" className="-mr-1.5" label={t('Remove {file}', { file: f.name })} icon={X} onClick={() => setFiles(files.filter(x => x.id !== f.id))} />
            </li>
          ))}
        </ul>
      )}

      <TextArea value={paste} onChange={e => setPaste(e.target.value.slice(0, SEED_MAX))} minRows={3} maxRows={8} aria-label={t('Paste your data')}
        placeholder={files.length ? t('Notes to go with the files (optional)') : t('Or paste a report, notes, a table…')} />

      {note && <p role="alert" className="text-small text-red">{note}</p>}

      <div className="flex flex-col gap-1.5">
        <span className="text-meta font-medium text-ink-3">{t('Who reads it')}</span>
        <Segmented size="sm" full label={t('Who reads it')} value={scope} onChange={setScope} options={[
          { value: 'brief', label: t('World model') },
          { value: 'panel', label: t('Every actor') },
        ]} />
        <p className="text-meta text-ink-3">
          {scope === 'brief'
            ? t('The world model reads all of it once and builds it into the brief every actor plays from.')
            : t('As well, every actor in every period of every world, and the report, read the first {n} characters directly and can quote them.', { n: PANEL_SEED_MAX })}
        </p>
      </div>

      <p className="text-small text-ink-2">
        {chars
          ? t.rich('{calls, plural, one {About {tokens} extra input tokens on your {provider} key, over # call.} other {About {tokens} extra input tokens on your {provider} key, over # calls.}}', {
            tokens: <span className="font-mono text-ink-1 tabular-nums">{fmtCount(cost.tokens)}</span>, provider: shortName(providerName), calls: cost.calls,
          })
          : t('Billed to your own key as input tokens: about one for every four characters.')}
      </p>
      {chars > SEED_MAX && <p className="text-small text-amber">{t('That is {chars} characters; a forecast reads the first {max}.', { chars: fmtCount(chars), max: SEED_MAX })}</p>}
    </div>
  );
}
