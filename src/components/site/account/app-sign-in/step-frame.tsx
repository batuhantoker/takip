import type { ReactNode } from 'react';
import { TakipMark } from '@/components/shell/brand/takip-mark';

/** One step of an app's sign-in: the mark and a line of where it stands, in the system browser or the app. */
export default function StepFrame({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="docs-root flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-0 px-6 text-center text-ink-1">
      <TakipMark className="h-12 w-auto" />
      <h1 role="status" className="m-0 text-[17px] font-medium">{title}</h1>
      {children}
    </main>
  );
}
