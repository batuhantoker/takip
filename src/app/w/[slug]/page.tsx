import { notFound, redirect } from 'next/navigation';

/** A share link, /w/<slug>?t=<epoch ms>: the map opens it read-only (components/workspaces/use-shared-link.ts). */
export default async function SharedWorkspaceLink({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) notFound();
  const { t } = await searchParams;
  const at = Array.isArray(t) ? t[0] : t;
  const query = new URLSearchParams({ w: slug });
  if (at && /^\d{1,15}$/.test(at)) query.set('t', at);
  redirect(`/?${query}`);
}
