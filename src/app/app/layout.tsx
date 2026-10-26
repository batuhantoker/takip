import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The apps' sign-in hand-off (src/lib/platform/native/handoff.ts); nothing here is for search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppHandoffLayout({ children }: { children: ReactNode }) {
  return children;
}
