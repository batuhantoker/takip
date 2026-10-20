import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { compareMetadata, ComparePage } from '@/components/site/compare/compare-page';

type Props = { params: Promise<{ pair: string; measure?: string[] }> };

/** /compare/<a>-vs-<b> and /compare/<a>-vs-<b>/<measure>; anything deeper is not a page. */
const parts = async (params: Props['params']) => {
  const { pair, measure = [] } = await params;
  return measure.length > 1 ? null : { slug: pair, measure: measure[0] };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await parts(params);
  return p ? compareMetadata(p.slug, p.measure) : {};
}

export default async function CompareRoute({ params }: Props) {
  const p = await parts(params);
  const page = p && await ComparePage(p);
  if (!page) notFound();
  return page;
}
