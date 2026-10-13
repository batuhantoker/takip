import type { Metadata } from 'next';
import KitPage from '@/components/site/kit/kit-page';

export const metadata: Metadata = {
  title: 'Kit',
  description: 'The interface parts TAKIP is built from, in every state.',
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  return <KitPage />;
}
