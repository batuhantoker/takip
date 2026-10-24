import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { compareMetadata, ComparePage } from '@/components/site/compare/compare-page';

type Props = { params: Promise<{ pair: string; measure?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /compare/<a>-vs-<b> and /compare/<a>-vs-<b>/<measure>, with the reader's view in the query; anything deeper is not a page. */
const parts = async ({ params, searchParams }: Props) => {
  const { pair, measure = [] } = await params;
  const search = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => {
    const one = Array.isArray(v) ? v[0] : v;
    return one === undefined ? [] : [[k, one]];
  })).toString();
  return measure.length > 1 ? null : { slug: pair, measure: measure[0], search };
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const p = await parts(props);
  return p ? compareMetadata(p.slug, p.measure, p.search) : {};
}

export default async function CompareRoute(props: Props) {
  const p = await parts(props);
  const page = p && await ComparePage(p);
  if (!page) notFound();
  return page;
}
