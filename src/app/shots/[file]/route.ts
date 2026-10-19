import { readFile } from 'node:fs/promises';
import { shotFile } from '@/lib/platform/site/shots';

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const path = file.endsWith('.jpg') ? shotFile(file.slice(0, -4)) : null;
  const body = path && await readFile(path).catch(() => null);
  if (!body) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
