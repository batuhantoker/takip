import type { Metadata } from 'next';
import DocsClient from '@/components/site/docs/docs-client';
import { ENDPOINT_COUNT } from '@/components/site/docs/api-catalog';
import { getT } from '@/lib/core/i18n/request';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t('Documentation & API Reference'),
    description: t('Official TAKIP documentation — self-hosting guide, interface reference, and the complete API reference for all {n} endpoints covering aviation, maritime, seismic, conflict, cyber, and OSINT feeds. No API key required.', { n: ENDPOINT_COUNT }),
    alternates: { canonical: '/docs' },
    openGraph: {
      title: t('TAKIP — Documentation & API Reference'),
      description: t('Self-hosting guide, interface reference, and the complete API reference for all {n} TAKIP endpoints.', { n: ENDPOINT_COUNT }),
      url: '/docs',
      type: 'article',
    },
  };
}

export default function DocsPage() {
  return <DocsClient />;
}
