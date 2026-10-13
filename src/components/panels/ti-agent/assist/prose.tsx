'use client';
/** TAKIP TI Assist: TI's words, set as prose: paragraphs, "- " lines as a list, links and **bold**. */
import type { ReactNode } from 'react';

const INLINE = /(https?:\/\/[^\s)]+)|\*\*([^*]+)\*\*/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const url = m[1].replace(/[.,;:]+$/, '');
      out.push(
        <a key={m.index} href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline-offset-2 hover:underline">
          {url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
        </a>,
      );
      if (url.length < m[1].length) out.push(m[1].slice(url.length));
    } else {
      out.push(<strong key={m.index} className="font-medium text-ink-1">{m[2]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Prose({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: number) => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u${k}`} className="flex flex-col gap-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-3" />
              <span className="min-w-0">{inline(b)}</span>
            </li>
          ))}
        </ul>,
      );
    }
    bullets = [];
  };
  text.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (/^[-•*]\s+/.test(t)) bullets.push(t.replace(/^[-•*]\s+/, ''));
    else { flush(i); if (t) blocks.push(<p key={i}>{inline(t)}</p>); }
  });
  flush(-1);
  return <div className="flex flex-col gap-3 text-body leading-5 text-ink-1 [overflow-wrap:anywhere]">{blocks}</div>;
}
