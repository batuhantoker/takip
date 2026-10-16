'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LoaderCircle, Search, ShieldCheck, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import {
  DONBOT_ORIGIN, DONBOT_ANALYZER, DONBOT_CHAINS, DONBOT_SANDBOX,
  cleanQuery, donbotFrameUrl, parseDonbotMessage, type DonbotResult,
} from '@/lib/intel/markets/donbot';

/**
 * DonBot, in Markets and in Recon: DigitalDon's token analyzer,
 * embedded without its script. See lib/intel/markets/donbot for what crosses the boundary and why.
 */

const INITIAL_HEIGHT = 420;

export default function DonBotScan({ initial = null, onScan }: {
  /** A scan to open on — how a host that remounts this keeps the token it was showing. */
  initial?: string | null;
  /** Told of every scan run and every close, so a host can hand it back as `initial`. */
  onScan?: (query: string | null) => void;
} = {}) {
  const [input, setInput] = useState(initial ?? '');
  /** What the frame is showing; null means no frame at all. */
  const [query, setQuery] = useState<string | null>(initial);
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<DonbotResult | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!query) return;
    const onMessage = (event: MessageEvent) => {
      // Their origin, and our own frame — not some other page's.
      if (event.origin !== DONBOT_ORIGIN || event.source !== frame.current?.contentWindow) return;
      const message = parseDonbotMessage(event.data);
      if (!message) return;
      if (message.type === 'resize') setHeight(message.height);
      else setResult(message);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [query]);

  const scan = () => {
    const q = cleanQuery(input);
    if (!q) return;
    setResult(null);
    setLoaded(false);
    setHeight(INITIAL_HEIGHT);
    setQuery(q);
    onScan?.(q);
  };

  const close = () => {
    setQuery(null);
    setResult(null);
    onScan?.(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={e => { e.preventDefault(); scan(); }} className="flex gap-2">
        <TextField
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ticker, name or contract address"
          aria-label="Token to analyse"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1"
          leading={<Search aria-hidden className="size-4" strokeWidth={1.75} />}
        />
        <Button type="submit" variant="primary" disabled={!cleanQuery(input)}>Analyse</Button>
      </form>

      <p className="text-meta text-ink-3">{DONBOT_CHAINS.join(' · ')}</p>

      {!query && (
        <div className="rounded-card border border-line bg-surface-2 p-3">
          <p className="text-small text-ink-2">
            A signal score out of 100, entry and exit zones, and the holder cluster map for any token:
            top wallets, the ones linked by funding, and snipers, bundles and fresh wallets flagged.
          </p>
          <p className="mt-2 flex items-start gap-2 text-meta text-ink-3">
            <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={1.75} />
            <span>
              Nothing loads until you analyse a token. DonBot then runs sealed in its own frame: none of its
              code runs on TAKIP, and it isn’t told which site you’re on.
            </span>
          </p>
        </div>
      )}

      {query && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 truncate text-small">
              {result ? (
                <span title={result.thesis}>
                  <span className="font-mono font-medium text-ink-1">${result.symbol}</span>
                  <span className="text-ink-3"> · signal </span>
                  <span className="font-mono font-medium text-ink-1 tabular-nums">{result.score}/100</span>
                  {result.thesis && <span className="text-ink-2"> · {result.thesis}</span>}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-ink-3">
                  {!loaded && <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.75} />}
                  {loaded ? `Analysing “${query}”…` : 'Loading DonBot…'}
                </span>
              )}
            </div>
            <IconButton size="sm" icon={X} label="Close DonBot" onClick={close} />
          </div>

          <iframe
            key={query}
            ref={frame}
            src={donbotFrameUrl(query)}
            title="DonBot token analysis by DigitalDon"
            sandbox={DONBOT_SANDBOX}
            referrerPolicy="no-referrer"
            allow="fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            className="block w-full rounded-card border-0 bg-transparent"
            style={{ height }}
          />

          <div className="flex items-center justify-between text-meta text-ink-3">
            <span>{result ? 'Not financial advice.' : ''}</span>
            <a href={DONBOT_ANALYZER} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink-1">
              DonBot by DigitalDon <ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
