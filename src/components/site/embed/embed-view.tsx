import type { Metadata } from 'next';
import { getT } from '@/lib/core/i18n/request';
import type { EmbedSpec } from '@/lib/map/embed/spec';
import EmbedMap from './parts/embed-map';
import { EmbedCta } from './parts/embed-cta';

/** An embed is a frame inside one of our pages, never a page of its own in search. */
export const embedMetadata = (title: string): Metadata => ({
  title,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
});

/** What an iframe shows: the map for `spec`, full-bleed, and the way into the full map at `fullMap`. */
export async function EmbedView({ spec, fullMap }: { spec: EmbedSpec; fullMap: string }) {
  const t = await getT();
  return (
    <main className="fixed inset-0 overflow-hidden bg-surface-0">
      <EmbedMap spec={spec} />
      <EmbedCta href={fullMap} label={t('Open the full map')} />
    </main>
  );
}
