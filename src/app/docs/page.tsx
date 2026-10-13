import type { Metadata } from 'next';
import DocsClient from '@/components/site/docs/docs-client';
import { ENDPOINT_COUNT } from '@/components/site/docs/api-catalog';

export const metadata: Metadata = {
  title: 'Documentation & API Reference',
  description: `Official TAKIP documentation — self-hosting guide, interface reference, and the complete API reference for all ${ENDPOINT_COUNT} endpoints covering aviation, maritime, seismic, conflict, cyber, and OSINT feeds. No API key required.`,
  alternates: { canonical: '/docs' },
  openGraph: {
    title: 'TAKIP — Documentation & API Reference',
    description: `Self-hosting guide, interface reference, and the complete API reference for all ${ENDPOINT_COUNT} TAKIP endpoints.`,
    url: '/docs',
    type: 'article',
  },
};

export default function DocsPage() {
  return <DocsClient />;
}
