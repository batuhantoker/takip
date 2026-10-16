import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Result, Workspace, WorkspacesApi } from './api';
import { readCurrent, writeCurrent } from './device';
import { createPartRegistry } from './parts';
import { createWorkspaceSession, type WorkspaceSession } from './session';
import type { TimeState, WorkspaceStateV1 } from './state';
import { MemoryStorage } from './testing';

/** The api's behaviour, in memory: revs, If-Match, share slugs. */
function fakeApi() {
  const rows = new Map<string, Workspace>();
  const slugs = new Map<string, string>();
  let next = 1;
  const ok = <T>(data: T): Result<T> => ({ data: structuredClone(data) });
  const fail = (error: string, status: number, extra = {}): Result<never> => ({ failure: { error, status, ...extra } });
  const api: WorkspacesApi = {
    list: async () => ok({ workspaces: [...rows.values()].map(({ id, name, rev, visibility, shareSlug, createdAt, updatedAt }) => ({ id, name, rev, visibility, shareSlug, createdAt, updatedAt })), max: 5 }),
    get: async id => (rows.has(id) ? ok(rows.get(id)!) : fail('not_found', 404)),
    create: async (name, state) => {
      const id = `W${next++}`;
      rows.set(id, { id, name, state, stateVersion: 1, rev: 1, visibility: 'private', shareSlug: null, createdAt: 1, updatedAt: 1 });
      return ok(rows.get(id)!);
    },
    update: async (id, change, ifMatch) => {
      const row = rows.get(id);
      if (!row) return fail('not_found', 404);
      if (ifMatch !== '*' && ifMatch !== row.rev) return fail('stale_rev', 409, { rev: row.rev });
      rows.set(id, { ...row, ...change, rev: row.rev + 1 });
      return ok(rows.get(id)!);
    },
    remove: async id => (rows.delete(id) ? ok({ ok: true as const }) : fail('not_found', 404)),
    share: async id => {
      const slug = `slug${next++}`;
      slugs.set(slug, id);
      rows.set(id, { ...rows.get(id)!, shareSlug: slug });
      return ok({ slug, path: `/w/${slug}` });
    },
    unshare: async () => ok({ ok: true as const }),
    shared: async slug => {
      const row = rows.get(slugs.get(slug) ?? '');
      return row && row.shareSlug === slug ? ok({ name: row.name, state: row.state, stateVersion: 1, updatedAt: 1 }) : fail('not_found', 404);
    },
  };
  return { api, rows, update: vi.spyOn(api, 'update') };
}

let fake: ReturnType<typeof fakeApi>;
let storage: MemoryStorage;
let view: { layers: Record<string, boolean>; time: TimeState };
let session: WorkspaceSession;

beforeEach(() => {
  vi.useFakeTimers();
  fake = fakeApi();
  storage = new MemoryStorage();
  view = { layers: { maritime: true }, time: { mode: 'live' } };
  const parts = createPartRegistry();
  parts.register('layers', { get: () => view.layers, set: v => { view.layers = v; } });
  parts.register('time', { get: () => view.time, set: v => { view.time = v; } });
  session = createWorkspaceSession({ api: fake.api, parts, storage });
});
afterEach(() => vi.useRealTimers());

const edit = async (layers: Record<string, boolean>) => {
  view.layers = layers;
  session.changed();
  await vi.advanceTimersByTimeAsync(2000);
};
const seed = (name: string, state: WorkspaceStateV1) => fake.api.create(name, state).then(r => r.data!);

describe('the workspace session', () => {
  it('opens the account\'s current workspace on sign-in and autosaves changes to it', async () => {
    const saved = await seed('Black Sea', { v: 1, time: { mode: 'live' }, layers: { maritime: false, flights: true } });
    writeCurrent(storage, 'ada', saved.id);
    await session.signIn('ada');
    expect(view.layers).toEqual({ maritime: false, flights: true });
    expect(session.get()).toMatchObject({ current: { id: saved.id, name: 'Black Sea', rev: 1 }, status: 'saved' });

    session.changed();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fake.update).not.toHaveBeenCalled();

    await edit({ maritime: true });
    expect(fake.update).toHaveBeenCalledWith(saved.id, { state: { v: 1, layers: { maritime: true }, time: { mode: 'live' } } }, '*', { keepalive: false });
    expect(session.get()).toMatchObject({ current: { rev: 2 }, status: 'saved' });
  });

  it('saves a new workspace and makes it current', async () => {
    await session.signIn('ada');
    expect(await session.saveAs('Straits')).toBeNull();
    const { current } = session.get();
    expect(current).toMatchObject({ name: 'Straits', rev: 1 });
    expect(readCurrent(storage, 'ada')).toBe(current!.id);
    expect(fake.rows.get(current!.id)!.state).toEqual({ v: 1, layers: { maritime: true }, time: { mode: 'live' } });
  });

  it('refuses an explicit Save over a change made elsewhere, until told to overwrite', async () => {
    await session.signIn('ada');
    await session.saveAs('Straits');
    const id = session.get().current!.id;
    await fake.api.update(id, { name: 'Renamed on the phone' }, '*');

    view.layers = { maritime: false };
    expect(await session.save()).toMatchObject({ error: 'stale_rev', rev: 2 });
    expect(session.get().conflict).toEqual({ rev: 2 });
    expect(fake.rows.get(id)!.state.layers).toEqual({ maritime: true });

    expect(await session.overwrite()).toBeNull();
    expect(session.get()).toMatchObject({ conflict: null, current: { rev: 3 }, status: 'saved' });
    expect(fake.rows.get(id)!.state.layers).toEqual({ maritime: false });
  });

  it('shows a shared workspace without saving over yours, then puts yours back', async () => {
    const theirs = await seed('Theirs', { v: 1, layers: { flights: true }, time: { mode: 'live' } });
    const slug = (await fake.api.share(theirs.id)).data!.slug;
    await session.signIn('ada');
    await session.saveAs('Mine');
    const mine = session.get().current!.id;
    storage.setItem('takip.layers', JSON.stringify({ maritime: true }));

    await session.viewShared(slug, 1_700_000_000_000);
    expect(view).toEqual({ layers: { flights: true }, time: { mode: 'replay', t: 1_700_000_000_000 } });
    expect(session.get().shared).toEqual({ slug, name: 'Theirs', at: 1_700_000_000_000 });
    storage.setItem('takip.layers', JSON.stringify({ flights: true }));
    await edit({ flights: false });
    expect(fake.update).not.toHaveBeenCalled();

    await session.leaveShared();
    expect(view.layers).toEqual({ maritime: true });
    expect(storage.getItem('takip.layers')).toBe(JSON.stringify({ maritime: true }));
    expect(session.get()).toMatchObject({ shared: null, current: { id: mine } });
    expect(fake.rows.get(mine)!.state.layers).toEqual({ maritime: true });
  });

  it('imports this device once on first sign-in, as the current workspace', async () => {
    storage.setItem('takip.layers', JSON.stringify({ flights: true }));
    await session.signIn('ada');
    expect(session.get().offerImport).toBe(true);
    await session.acceptImport();
    await session.acceptImport();
    expect(fake.rows.size).toBe(1);
    expect(session.get().current).toMatchObject({ name: 'Imported from this device' });

    session.signOut();
    await session.signIn('ada');
    expect(session.get().offerImport).toBe(false);
  });

  it('forgets a current workspace deleted elsewhere', async () => {
    await session.signIn('ada');
    await session.saveAs('Gone soon');
    const id = session.get().current!.id;
    fake.rows.delete(id);
    await edit({ maritime: false });
    expect(session.get()).toMatchObject({ current: null, problem: { error: 'not_found' } });
    expect(readCurrent(storage, 'ada')).toBeNull();
  });
});
