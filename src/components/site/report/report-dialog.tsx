'use client';

import { useState, type FormEvent } from 'react';
import { CircleCheck } from 'lucide-react';
import { buildReportView, type MapCamera, type ViewInputs } from '@/lib/platform/reports/report-view';
import { MAX_MESSAGE, MIN_MESSAGE, sendReport, type SendFailure } from '@/lib/platform/reports/reports-api';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { closeReportDialog, useReportDialog, type ReportRequest } from './report-dialog-state';

const TOO_SHORT = `Add a little more: at least ${MIN_MESSAGE} characters.`;

function failureText(failure: SendFailure) {
  switch (failure.error) {
    case 'rate_limited': return `That's a lot of reports in a short time. Try again in ${Math.max(1, Math.ceil(failure.retryAfterS / 60))} min.`;
    case 'invalid': return "That didn't go through. Check the message and try again.";
    case 'network': return "Couldn't reach TAKIP. Check your connection and try again.";
    case 'failed': return 'Something went wrong on our side. Try again in a moment.';
  }
}

/** The settled camera the map writes on its container (bind-view-events.ts): bearing and pitch live only there. */
function readCamera(): MapCamera | null {
  const raw = document.querySelector<HTMLElement>('[data-map-camera]')?.dataset.mapCamera;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MapCamera;
  } catch {
    return null;
  }
}

/** Mount once per page. `view` is asked for on Send, so the report carries the map as it is then. */
export default function ReportDialog({ view }: { view: () => ViewInputs }) {
  const request = useReportDialog();
  return (
    <Modal open={request !== null} onClose={closeReportDialog} title="Report an issue">
      {request && <ReportForm key={request.ts} request={request} view={view} />}
    </Modal>
  );
}

function ReportForm({ request, view }: { request: ReportRequest; view: () => ViewInputs }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tooShort, setTooShort] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = message.trim();
    if (text.length < MIN_MESSAGE) {
      setTooShort(true);
      return;
    }
    setSending(true);
    setFailure(null);
    const snapshot = buildReportView(view(), {
      camera: readCamera(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      point: request.point,
      fallbackLink: `${window.location.pathname}${window.location.search}`,
    });
    const failed = await sendReport({ message: text, view: snapshot });
    setSending(false);
    if (failed) setFailure(failureText(failed));
    else setSent(true);
  };

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-body font-medium text-ink-1">
          <CircleCheck aria-hidden className="size-4 text-green" strokeWidth={1.75} />
          Thanks, we&apos;ve got it.
        </p>
        <div className="flex justify-end">
          {/* The form that held focus is gone; keep focus inside the dialog. */}
          <Button variant="primary" onClick={closeReportDialog} autoFocus>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <TextArea
        label="What's wrong?"
        placeholder="What did you see, and what did you expect?"
        value={message}
        onChange={e => {
          setMessage(e.target.value);
          if (tooShort && e.target.value.trim().length >= MIN_MESSAGE) setTooShort(false);
        }}
        maxLength={MAX_MESSAGE}
        rows={5}
        readOnly={sending}
        error={tooShort ? TOO_SHORT : undefined}
        data-autofocus
      />
      <p className="text-meta text-ink-3">
        We&apos;ll attach what&apos;s on your map: the view, layers and mode{request.point ? ', and the spot you clicked' : ''}.
      </p>
      {failure && <p role="alert" className="text-small text-red">{failure}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={closeReportDialog}>Cancel</Button>
        <Button variant="primary" type="submit" loading={sending}>{sending ? 'Sending…' : 'Send'}</Button>
      </div>
    </form>
  );
}
