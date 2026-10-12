import { z } from '@hono/zod-openapi';
import { MAX_STATE_BYTES, WorkspaceStateV1 } from './state';

const Name = z.string().trim().min(1).max(80).openapi({ example: 'Black Sea watch' });
const Id = z.string().openapi({ description: 'A ULID.', example: '01K7E3Q9V7J4M2X8N5B6C1D0FG' });
const Times = { createdAt: z.number().int().openapi({ description: 'Epoch ms.' }), updatedAt: z.number().int().openapi({ description: 'Epoch ms.' }) };

export const WorkspaceSummary = z.object({
  id: Id,
  name: z.string(),
  rev: z.number().int().openapi({ description: 'Bumped by every PUT; send it back as If-Match.' }),
  visibility: z.enum(['private', 'link', 'public']),
  shareSlug: z.string().nullable().openapi({ description: 'Set while a share link works: /w/<shareSlug>.' }),
  ...Times,
}).openapi('WorkspaceSummary');

export const Workspace = WorkspaceSummary.extend({ state: WorkspaceStateV1, stateVersion: z.number().int() }).openapi('Workspace');

export const WorkspaceList = z.object({
  workspaces: z.array(WorkspaceSummary),
  max: z.number().int().openapi({ description: "How many the caller's plan allows (workspaces.max)." }),
}).openapi('WorkspaceList');

export const SharedWorkspace = z.object({
  name: z.string(),
  state: WorkspaceStateV1,
  stateVersion: z.number().int(),
  updatedAt: Times.updatedAt,
}).openapi('SharedWorkspace', { description: "Read-only; never names the owner, and leaves out the owner's recent places and watchlist." });

export const ShareLink = z.object({
  slug: z.string(),
  path: z.string().openapi({ example: '/w/q3Yp8vVx1kR7tLm2', description: 'Add ?t=<epoch ms> to open it at a moment in replay.' }),
}).openapi('ShareLink');

export const CreateBody = z.object({ name: Name, state: WorkspaceStateV1 }).openapi('NewWorkspace');

export const UpdateBody = z.object({ name: Name.optional(), state: WorkspaceStateV1.optional() })
  .refine(body => body.name !== undefined || body.state !== undefined, 'Send a name, a state, or both.')
  .openapi('WorkspaceChange');

export const Ok = z.object({ ok: z.literal(true) }).openapi('Ok');

export const RequestError = z.object({ error: z.string(), message: z.string().optional() }).openapi('RequestError');

export const PlanLimit = z.object({
  error: z.enum(['limit_reached', 'entitlement_required']),
  entitlement: z.string(),
  limit: z.number().int().optional(),
  upgrade_url: z.string(),
}).openapi('PlanLimit');

export const StaleRev = z.object({ error: z.literal('stale_rev'), rev: z.number().int().openapi({ description: 'The stored rev.' }) }).openapi('StaleRev');

export const TooLarge = z.object({ error: z.literal('too_large'), limit: z.literal(MAX_STATE_BYTES) }).openapi('StateTooLarge');
