type NextRoute = { GET: (request: Request) => Promise<Response> };
type NextServer = { NextRequest: new (url: string) => Request };

// Non-literal specifiers keep the Next app (and its @/ alias) out of the api's typecheck.
const load = <T>(specifier: string) => import(/* @vite-ignore */ specifier) as Promise<T>;

/** The legacy Next handler's GET, called with a NextRequest as Next would. */
export async function legacyGet(module: string) {
  const { GET } = await load<NextRoute>(module);
  const { NextRequest } = await load<NextServer>('next/server');
  return (path: string) => GET(new NextRequest(`http://localhost${path}`));
}
