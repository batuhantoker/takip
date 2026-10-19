'use client';

import { useState } from 'react';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';

/* ─────────────────────────────────────────────────────────────
   Inline code
   ───────────────────────────────────────────────────────────── */

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[12px] px-1.5 py-0.5 rounded-[4px] bg-surface-2 border border-line text-ink-1 whitespace-nowrap">
      {children}
    </code>
  );
}

/* ─────────────────────────────────────────────────────────────
   Copy button
   ───────────────────────────────────────────────────────────── */

export function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked on insecure origins — leave the control inert */
    }
  };

  return (
    <button
      onClick={copy}
      aria-label={copied ? t('Copied') : t('Copy to clipboard')}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        copied ? 'text-green' : 'text-ink-3 hover:bg-surface-3 hover:text-ink-1'
      } ${className}`}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
      {copied ? t('Copied') : t('Copy')}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Syntax highlighting — deliberately minimal.
   A full tokenizer is not worth the bundle here; these are short,
   well-formed snippets in three known languages.
   ───────────────────────────────────────────────────────────── */

/* Escapes every character that could open a tag or break an attribute. This runs
   BEFORE any span injection below, so highlighted output can never contain
   markup originating from the source string — which matters because live API
   responses from the "Send request" runner are rendered through here. */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Upper bound on what we will tokenize, to keep pathological payloads cheap. */
const MAX_HIGHLIGHT_CHARS = 20_000;

function highlight(source: string, lang: string): string {
  // Oversized input is escaped but left untokenized rather than run through
  // every regex pass.
  if (source.length > MAX_HIGHLIGHT_CHARS) return escapeHtml(source);

  let html = escapeHtml(source);

  if (lang === 'json') {
    html = html
      .replace(/&quot;([^&]*?)&quot;(\s*:)/g, '<span class="tok-key">&quot;$1&quot;</span>$2')
      .replace(/:\s*&quot;([^&]*?)&quot;/g, ': <span class="tok-str">&quot;$1&quot;</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="tok-lit">$1</span>')
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
    return html;
  }

  if (lang === 'bash') {
    html = html
      .replace(/(^|\n)(\s*)(#.*)/g, '$1$2<span class="tok-com">$3</span>')
      .replace(/\b(curl|jq|npm|git|docker|cd|cp|openssl|compose)\b/g, '<span class="tok-fn">$1</span>')
      .replace(/(\s)(-{1,2}[a-zA-Z][\w-]*)/g, '$1<span class="tok-lit">$2</span>')
      .replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-str">$1</span>');
    return html;
  }

  // javascript / python
  html = html
    .replace(/(^|\n)(\s*)(#[^\n]*)/g, '$1$2<span class="tok-com">$3</span>')
    .replace(/(\/\/[^\n]*)/g, '<span class="tok-com">$1</span>')
    .replace(
      /\b(const|let|var|await|async|function|return|import|from|def|print|if|else|for|in|with|as)\b/g,
      '<span class="tok-kw">$1</span>'
    )
    .replace(/\b(fetch|json|requests|get|post|dumps|len)\b(?=\s*[(.])/g, '<span class="tok-fn">$1</span>')
    .replace(/(&quot;[^&\n]*?&quot;|&#39;[^&\n]*?&#39;|`[^`\n]*?`)/g, '<span class="tok-str">$1</span>');
  return html;
}

/* ─────────────────────────────────────────────────────────────
   Code block — optionally with language tabs
   ───────────────────────────────────────────────────────────── */

export interface CodeTab {
  label: string;
  lang: string;
  code: string;
}

export function CodeBlock({
  tabs,
  label,
  dense = false,
}: {
  tabs: CodeTab[];
  label?: string;
  dense?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const active = tabs[Math.min(idx, tabs.length - 1)];

  return (
    <div className={`rounded-card border border-line bg-surface-2 overflow-hidden ${dense ? 'my-3' : 'my-5'}`}>
      <div className="flex items-center gap-1 px-2 h-9 border-b border-line">
        {label && !tabs.length && (
          <span className="text-[12px] text-ink-3 px-2">{label}</span>
        )}
        {tabs.length > 1 ? (
          tabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setIdx(i)}
              className={`text-[12px] font-medium px-2.5 h-7 rounded-md transition-colors ${
                i === idx ? 'text-ink-1 bg-surface-3' : 'text-ink-3 hover:text-ink-1'
              }`}
            >
              {tab.label}
            </button>
          ))
        ) : (
          <span className="text-[12px] text-ink-3 px-2">
            {label || tabs[0]?.label}
          </span>
        )}
        <div className="flex-1" />
        <CopyButton value={active?.code || ''} className="mr-1" />
      </div>

      <pre className="overflow-x-auto styled-scrollbar p-4 text-[12px] leading-[1.7] font-mono docs-code">
        <code dangerouslySetInnerHTML={{ __html: highlight(active?.code || '', active?.lang || 'bash') }} />
      </pre>
    </div>
  );
}

/** Convenience wrapper for a single, untabbed snippet. */
export function Pre({ children, label, lang = 'bash' }: { children: string; label?: string; lang?: string }) {
  return <CodeBlock tabs={[{ label: label || lang, lang, code: children }]} label={label} />;
}

/* ─────────────────────────────────────────────────────────────
   Callout
   ───────────────────────────────────────────────────────────── */

const CALLOUT_TONES = {
  info: { border: 'var(--blue)', icon: 'M12 16v-4M12 8h.01', label: msg('Note') },
  warn: { border: 'var(--amber)', icon: 'M12 9v4M12 17h.01', label: msg('Caution') },
  good: { border: 'var(--green)', icon: 'M20 6 9 17l-5-5', label: msg('Tip') },
};

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof CALLOUT_TONES;
  title?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const look = CALLOUT_TONES[tone];
  return (
    <div className="rounded-card p-4 my-5 border border-line bg-surface-2 border-l-2" style={{ borderLeftColor: look.border }}>
      <div className="flex items-center gap-2 mb-1.5">
        <svg
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5 shrink-0"
          fill="none"
          stroke={look.border}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {tone !== 'good' && <circle cx="12" cy="12" r="9" />}
          <path d={look.icon} />
        </svg>
        <span className="text-[13px] font-semibold text-ink-1">{title || t(look.label)}</span>
      </div>
      <div className="text-[13px] leading-[1.7] text-ink-2">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section with an anchor link
   ───────────────────────────────────────────────────────────── */

export function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section id={id} className="scroll-mt-28 mb-20">
      {eyebrow && (
        <div className="text-[12px] font-medium text-ink-3 mb-1.5">{eyebrow}</div>
      )}
      <h2 className="group flex items-center gap-2 text-[22px] md:text-[24px] font-semibold text-ink-1 tracking-tight mb-4">
        {title}
        <a
          href={`#${id}`}
          aria-label={t('Link to {title}', { title })}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-ink-3 hover:text-ink-1"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
          </svg>
        </a>
      </h2>
      <div className="space-y-4 text-[15px] leading-[1.7] text-ink-2">{children}</div>
    </section>
  );
}
