import type { WorkspaceStateV1 } from './state';

/** The signed-in user's workspaces (apps/api/src/workspaces/routes.ts). Times are epoch ms. */

export type WorkspaceSummary = {
  id: string;
  name: string;
  rev: number;
  visibility: 'private' | 'link' | 'public';
  shareSlug: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Workspace = WorkspaceSummary & { state: WorkspaceStateV1; stateVersion: number };
export type SharedWorkspace = { name: string; state: WorkspaceStateV1; stateVersion: number; updatedAt: number };

/** The api's error code; `network` when it couldn't be reached. `rev` comes with stale_rev, `limit` with limit_reached. */
export type WorkspaceFailure = { error: string; status: number; rev?: number; limit?: number };

export type Result<T> = { data: T; failure?: undefined } | { data?: undefined; failure: WorkspaceFailure };

type Send = (path: string, init?: RequestInit) => Promise<Response>;

async function send<T>(fetcher: Send, path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetcher(`/api/v1${path}`, { cache: 'no-store', ...init });
    const body = (await res.json().catch(() => ({}))) as T & Partial<WorkspaceFailure>;
    return res.ok ? { data: body } : { failure: { error: body.error ?? `http_${res.status}`, status: res.status, rev: body.rev, limit: body.limit } };
  } catch {
    return { failure: { error: 'network', status: 0 } };
  }
}

const jsonBody = (method: string, body: unknown, headers: Record<string, string> = {}): RequestInit =>
  ({ method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

const at = (id: string) => `/workspaces/${encodeURIComponent(id)}`;

export function workspacesApi(fetcher: Send = (...args) => fetch(...args)) {
  return {
    list: () => send<{ workspaces: WorkspaceSummary[]; max: number }>(fetcher, '/workspaces'),
    get: (id: string) => send<Workspace>(fetcher, at(id)),
    create: (name: string, state: WorkspaceStateV1) => send<Workspace>(fetcher, '/workspaces', jsonBody('POST', { name, state })),
    /** `ifMatch` is the rev last read, or `*` to overwrite (autosave). `keepalive` lets it finish as the page closes. */
    update: (id: string, change: { name?: string; state?: WorkspaceStateV1 }, ifMatch: number | '*', { keepalive = false } = {}) =>
      send<Workspace>(fetcher, at(id), { ...jsonBody('PUT', change, { 'if-match': ifMatch === '*' ? '*' : `"${ifMatch}"` }), keepalive }),
    remove: (id: string) => send<{ ok: true }>(fetcher, at(id), { method: 'DELETE' }),
    /** A new link each time; the previous one stops working. */
    share: (id: string) => send<{ slug: string; path: string }>(fetcher, `${at(id)}/share`, { method: 'POST' }),
    unshare: (id: string) => send<{ ok: true }>(fetcher, `${at(id)}/share`, { method: 'DELETE' }),
    shared: (slug: string) => send<SharedWorkspace>(fetcher, `/w/${encodeURIComponent(slug)}`),
  };
}

export type WorkspacesApi = ReturnType<typeof workspacesApi>;

/** The page a share link opens: read-only, at `t` (epoch ms) in replay when given. */
export function shareUrl(origin: string, slug: string, t?: number) {
  return `${origin}/w/${slug}${t === undefined ? '' : `?t=${Math.round(t)}`}`;
}
