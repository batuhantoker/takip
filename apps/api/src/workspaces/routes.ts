import { createRoute, OpenAPIHono, z, type Hook } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import type { AccessEnv } from '../access/middleware';
import type { AppDb } from '../db/app-db';
import { json } from '../v1/schemas';
import { isSlug, isUlid, newSlug } from './ids';
import {
  CreateBody, Ok, PlanLimit, RequestError, SharedWorkspace, ShareLink, StaleRev, TooLarge, UpdateBody, Workspace, WorkspaceList,
} from './schemas';
import { MAX_STATE_BYTES, stateBytes, withoutPrivateParts } from './state';
import { workspaceStore, type IfMatch } from './store';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const TOO_LARGE = { error: 'too_large', limit: MAX_STATE_BYTES } as const;
const NOT_FOUND = { error: 'not_found' } as const;
const etag = (rev: number) => ({ ...NO_STORE, ETag: `"${rev}"` });

const IdParam = z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' }, description: 'The workspace id.' }) });
const SlugParam = z.object({ slug: z.string().openapi({ param: { name: 'slug', in: 'path' } }) });
// The state cap plus room for the name and the JSON around them; the exact cap is checked after parsing.
const limitBody = bodyLimit({ maxSize: MAX_STATE_BYTES + 4096, onError: c => c.json(TOO_LARGE, 413) });

const ownerErrors = {
  401: { description: 'Not signed in.', content: json(RequestError) },
  403: { description: 'An API key limited to scopes: workspaces need an unrestricted key.', content: json(RequestError) },
};
const missing = { 404: { description: 'No such workspace for this caller, including other people\'s and deleted ones.', content: json(RequestError) } };
const tags = ['Workspaces'];

const listRoute = createRoute({
  method: 'get', path: '/workspaces', tags, summary: 'List your workspaces',
  description: 'Newest change first, without their state.',
  responses: { 200: { description: 'Your workspaces.', content: json(WorkspaceList) }, ...ownerErrors },
});

const createWorkspaceRoute = createRoute({
  method: 'post', path: '/workspaces', tags, summary: 'Save a workspace', middleware: [limitBody] as const,
  request: { body: { content: json(CreateBody), required: true } },
  responses: {
    201: { description: 'Saved; rev 1.', content: json(Workspace) },
    400: { description: 'The name or state is malformed.', content: json(RequestError) },
    401: ownerErrors[401],
    403: { description: 'At the plan\'s workspaces.max, or a key limited to scopes.', content: json(PlanLimit.or(RequestError)) },
    413: { description: `The state is over ${MAX_STATE_BYTES / 1024} KB.`, content: json(TooLarge) },
  },
});

const getRoute = createRoute({
  method: 'get', path: '/workspaces/{id}', tags, summary: 'Read a workspace',
  request: { params: IdParam },
  responses: { 200: { description: 'The workspace; its ETag is the rev.', content: json(Workspace) }, ...ownerErrors, ...missing },
});

const updateRoute = createRoute({
  method: 'put', path: '/workspaces/{id}', tags, summary: 'Change a workspace',
  description: 'Rename it, replace its state, or both. `If-Match: <rev>` refuses to overwrite a change made since that rev; `If-Match: *` overwrites (autosave).',
  middleware: [limitBody] as const,
  request: {
    params: IdParam,
    headers: z.object({ 'if-match': z.string().optional().openapi({ description: 'The rev last read, or *.', example: '"3"' }) }),
    body: { content: json(UpdateBody), required: true },
  },
  responses: {
    200: { description: 'Changed; the rev went up by one.', content: json(Workspace) },
    400: { description: 'The body or If-Match is malformed.', content: json(RequestError) },
    ...ownerErrors, ...missing,
    409: { description: 'Changed since that rev; the body carries the stored one.', content: json(StaleRev) },
    413: { description: `The state is over ${MAX_STATE_BYTES / 1024} KB.`, content: json(TooLarge) },
    428: { description: 'No If-Match header.', content: json(RequestError) },
  },
});

const deleteRoute = createRoute({
  method: 'delete', path: '/workspaces/{id}', tags, summary: 'Delete a workspace',
  description: 'Its share link stops working at once.',
  request: { params: IdParam },
  responses: { 200: { description: 'Deleted.', content: json(Ok) }, ...ownerErrors, ...missing },
});

const shareRoute = createRoute({
  method: 'post', path: '/workspaces/{id}/share', tags, summary: 'Create or replace its share link',
  description: 'Anyone with the link can view the workspace, read-only. Asking again makes a new link and the old one stops working.',
  request: { params: IdParam },
  responses: {
    200: { description: 'The link.', content: json(ShareLink) },
    401: ownerErrors[401],
    403: { description: 'The plan lacks workspaces.share, or a key limited to scopes.', content: json(PlanLimit.or(RequestError)) },
    ...missing,
  },
});

const unshareRoute = createRoute({
  method: 'delete', path: '/workspaces/{id}/share', tags, summary: 'Stop sharing',
  request: { params: IdParam },
  responses: { 200: { description: 'The link no longer works.', content: json(Ok) }, ...ownerErrors, ...missing },
});

const sharedRoute = createRoute({
  method: 'get', path: '/w/{slug}', tags, summary: 'Read a shared workspace',
  description: 'Needs no session. The web app opens /w/<slug>?t=<epoch ms> read-only, at that moment in replay.',
  request: { params: SlugParam },
  responses: {
    200: { description: 'The workspace.', content: json(SharedWorkspace) },
    404: { description: 'No such link, or it was revoked or replaced.', content: json(RequestError) },
  },
});

/** The account whose workspaces these are: a session or an unrestricted API key. */
function ownerOf(c: Context<AccessEnv>) {
  const { principal } = c.var;
  if (principal.kind === 'anon') return { error: c.json({ error: 'sign_in_required' }, 401) } as const;
  // No scope covers workspaces yet, so a key limited to scopes is kept to what it was limited to.
  if (principal.kind === 'key' && principal.scopes?.length) return { error: c.json({ error: 'insufficient_scope' }, 403) } as const;
  return { userId: principal.userId } as const;
}

/** `*`, or a rev with or without ETag quotes; undefined when it's neither. */
function parseIfMatch(header: string): IfMatch | undefined {
  const value = header.trim();
  if (value === '*') return '*';
  const rev = /^(?:W\/)?"?(\d{1,15})"?$/.exec(value)?.[1];
  return rev === undefined ? undefined : Number(rev);
}

const invalidRequest: Hook<unknown, AccessEnv, string, unknown> = (result, c) => {
  if (!result.success) return c.json({ error: 'invalid_request', message: z.prettifyError(result.error) }, 400);
};

/** Mounted at /api/v1 (backend.md §10). */
export function workspaceRoutes(db: AppDb, now = () => Date.now()) {
  const store = workspaceStore(db);
  const app = new OpenAPIHono<AccessEnv>({ defaultHook: invalidRequest });
  // Malformed JSON reaches here as Hono's plain-text 400.
  app.onError((err, c) => {
    if (err instanceof HTTPException && err.status === 400) return c.json({ error: 'invalid_request', message: err.message }, 400);
    throw err;
  });

  app.openapi(listRoute, c => {
    const owner = ownerOf(c);
    if (owner.error) return owner.error;
    return c.json({ workspaces: store.list(owner.userId), max: c.var.access.entitlements['workspaces.max'] }, 200, NO_STORE);
  });

  app.openapi(createWorkspaceRoute, c => {
    const owner = ownerOf(c);
    if (owner.error) return owner.error;
    const { name, state } = c.req.valid('json');
    if (stateBytes(state) > MAX_STATE_BYTES) return c.json(TOO_LARGE, 413);
    const max = c.var.access.entitlements['workspaces.max'];
    const created = store.create({ ownerId: owner.userId, name, state, max, at: now() });
    if (!created) return c.json({ error: 'limit_reached', entitlement: 'workspaces.max', limit: max, upgrade_url: '/pricing' } as const, 403);
    return c.json(created, 201, etag(created.rev));
  });

  app.openapi(getRoute, c => {
    const owner = ownerOf(c);
    if (owner.error) return owner.error;
    const { id } = c.req.valid('param');
    const found = isUlid(id) ? store.get(owner.userId, id) : null;
    return found ? c.json(found, 200, etag(found.rev)) : c.json(NOT_FOUND, 404);
  });

  app.openapi(updateRoute, c => {
    const owner = ownerOf(c);
    if (owner.error) return owner.error;
    const { id } = c.req.valid('param');
    const header = c.req.valid('header')['if-match'];
    if (header === undefined) return c.json({ error: 'if_match_required' }, 428);
    const ifMatch = parseIfMatch(header);
    if (ifMatch === undefined) return c.json({ error: 'invalid_request', message: 'If-Match must be a rev or *.' }, 400);
    const { name, state } = c.req.valid('json');
    if (state && stateBytes(state) > MAX_STATE_BYTES) return c.json(TOO_LARGE, 413);
    if (!isUlid(id)) return c.json(NOT_FOUND, 404);

    const result = store.update({ ownerId: owner.userId, id, ifMatch, name, state, at: now() });
    if (result.ok) return c.json(result.workspace, 200, etag(result.workspace.rev));
    if (result.error === 'stale_rev') return c.json({ error: 'stale_rev', rev: result.rev } as const, 409, etag(result.rev));
    return c.json(NOT_FOUND, 404);
  });

  app.openapi(deleteRoute, c => {
    const owner = ownerOf(c);
    if (owner.error) return owner.error;
    const { id } = c.req.valid('param');
    return isUlid(id) && store.remove(owner.userId, id, now()) ? c.json({ ok: true } as const, 200) : c.json(NOT_FOUND, 404);
  });

  app.openapi(shareRoute, c => {
    const owner = ownerOf(c);
    if (owner.error) return owner.error;
    const { id } = c.req.valid('param');
    if (!c.var.access.entitlements['workspaces.share']) {
      return c.json({ error: 'entitlement_required', entitlement: 'workspaces.share', upgrade_url: '/pricing' } as const, 403);
    }
    const slug = newSlug();
    if (!isUlid(id) || !store.setSlug(owner.userId, id, slug)) return c.json(NOT_FOUND, 404);
    return c.json({ slug, path: `/w/${slug}` }, 200, NO_STORE);
  });

  app.openapi(unshareRoute, c => {
    const owner = ownerOf(c);
    if (owner.error) return owner.error;
    const { id } = c.req.valid('param');
    return isUlid(id) && store.setSlug(owner.userId, id, null) ? c.json({ ok: true } as const, 200) : c.json(NOT_FOUND, 404);
  });

  app.openapi(sharedRoute, c => {
    const { slug } = c.req.valid('param');
    const found = isSlug(slug) ? store.shared(slug) : null;
    if (!found) return c.json(NOT_FOUND, 404);
    // Revocation has to apply at once, so no cache may keep a copy.
    return c.json({ ...found, state: withoutPrivateParts(found.state) }, 200, { 'Cache-Control': 'no-store' });
  });

  return app;
}
