import { workspacesApi, type Workspace, type WorkspaceFailure, type WorkspacesApi, type WorkspaceSummary } from './api';
import { createAutosave, type SaveStatus } from './autosave';
import { backUpDevice, createImporter, IMPORTED_NAME, markImportOffered, readCurrent, restoreDevice, shouldOfferImport, writeCurrent } from './device';
import { workspaceParts, type PartRegistry } from './parts';
import { PRIVATE_PARTS, readState, stateBytes, type WorkspaceStateV1 } from './state';
import { readDeviceState } from './stored-parts';

export type CurrentWorkspace = { id: string; name: string; rev: number; shareSlug: string | null };
/** A workspace someone shared, on screen read-only; `at` is the replay moment the link named. */
export type SharedView = { slug: string; name: string; at: number | null };

export type WorkspaceSnapshot = {
  userId: string | null;
  current: CurrentWorkspace | null;
  status: SaveStatus;
  shared: SharedView | null;
  /** The account's workspaces, newest change first; null until listed. */
  list: WorkspaceSummary[] | null;
  max: number | null;
  /** Why the last save, open or share didn't go through. */
  problem: WorkspaceFailure | null;
  /** An explicit Save refused because the workspace changed elsewhere; `rev` is the stored one. */
  conflict: { rev: number } | null;
  offerImport: boolean;
};

const INITIAL: WorkspaceSnapshot = {
  userId: null, current: null, status: 'saved', shared: null, list: null, max: null, problem: null, conflict: null, offerImport: false,
};

// keepalive requests are capped at 64 KB of body by browsers.
const KEEPALIVE_BYTES = 60_000;

const toCurrent = ({ id, name, rev, shareSlug }: Workspace): CurrentWorkspace => ({ id, name, rev, shareSlug });
const unreadable: WorkspaceFailure = { error: 'unsupported_state', status: 0 };

/**
 * The signed-in user's current workspace: opening, autosaving (last writer wins), explicit saves (If-Match),
 * share links, and viewing someone else's shared workspace without saving over your own.
 */
export function createWorkspaceSession({ api = workspacesApi(), parts = workspaceParts, storage, delayMs = 2000 }: {
  api?: WorkspacesApi; parts?: PartRegistry; storage: Storage; delayMs?: number;
}) {
  let snapshot = INITIAL;
  const listeners = new Set<() => void>();
  let closing = false;
  /** Your own state while a shared workspace is on screen. */
  let before: WorkspaceStateV1 | null = null;
  /** The current workspace to open once a shared view is left. */
  let openAfterShared: string | null = null;
  let importOnce: (() => ReturnType<WorkspacesApi['create']> | null) | null = null;

  const update = (patch: Partial<WorkspaceSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  };

  const autosave = createAutosave({
    capture: parts.capture,
    delayMs,
    onStatus: status => update({ status }),
    save: async state => {
      const current = snapshot.current;
      if (!current || snapshot.shared) return 'failed';
      const keepalive = closing && stateBytes(state) < KEEPALIVE_BYTES;
      const { data, failure } = await api.update(current.id, { state }, '*', { keepalive });
      if (data) {
        if (snapshot.current?.id === data.id) update({ current: toCurrent(data), problem: null });
        return 'saved';
      }
      if (failure.error === 'network') return 'offline';
      if (failure.status === 404) forget(current.id);
      update({ problem: failure });
      return 'failed';
    },
  });

  function forget(id: string) {
    if (snapshot.current?.id !== id) return;
    autosave.stop();
    if (snapshot.userId) writeCurrent(storage, snapshot.userId, null);
    update({ current: null });
  }

  function becomeCurrent(workspace: Workspace, state: WorkspaceStateV1) {
    if (snapshot.userId) writeCurrent(storage, snapshot.userId, workspace.id);
    update({ current: toCurrent(workspace), problem: null, conflict: null });
    autosave.baseline(state);
  }

  /** Drops the shared view without putting your own state back: what opens next replaces it. */
  function endShared() {
    if (!snapshot.shared) return;
    restoreDevice(storage);
    before = null;
    openAfterShared = null;
    update({ shared: null });
  }

  async function open(id: string): Promise<WorkspaceFailure | null> {
    const { data, failure } = await api.get(id);
    if (!data) {
      if (failure.status === 404) forget(id);
      update({ problem: failure });
      return failure;
    }
    const state = readState(data.state);
    if (!state) {
      update({ problem: unreadable });
      return unreadable;
    }
    if (snapshot.shared) endShared();
    else await autosave.flush();
    parts.apply(state);
    becomeCurrent(data, state);
    return null;
  }

  async function refreshList() {
    const { data } = await api.list();
    if (data) update({ list: data.workspaces, max: data.max });
  }

  async function saveAs(name: string): Promise<WorkspaceFailure | null> {
    const state = parts.capture();
    await autosave.idle();
    autosave.stop();
    const { data, failure } = await api.create(name, state);
    if (!data) {
      if (snapshot.current && !snapshot.shared) autosave.resume();
      return failure;
    }
    // A copy of a shared view is yours now; the device backup goes back at the next load.
    if (snapshot.shared) {
      before = null;
      openAfterShared = null;
      update({ shared: null });
    }
    becomeCurrent(data, state);
    void refreshList();
    return null;
  }

  async function writeCurrentState({ overwrite }: { overwrite: boolean }): Promise<WorkspaceFailure | null> {
    if (!snapshot.current) return null;
    // Our own autosave in flight would bump the rev under us.
    await autosave.idle();
    autosave.stop();
    const current = snapshot.current;
    const state = parts.capture();
    const { data, failure } = await api.update(current.id, { state }, overwrite ? '*' : current.rev);
    if (data) {
      becomeCurrent(data, state);
      return null;
    }
    if (failure.error === 'stale_rev' && failure.rev !== undefined) update({ conflict: { rev: failure.rev } });
    else update({ problem: failure });
    if (failure.status === 404) forget(current.id);
    else autosave.resume();
    return failure;
  }

  return {
    get: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async signIn(userId: string) {
      if (snapshot.userId === userId) return;
      autosave.stop();
      update({ ...INITIAL, userId, shared: snapshot.shared, offerImport: shouldOfferImport(storage) });
      importOnce = createImporter(storage, (name, state) => api.create(name, state));
      void refreshList();
      const id = readCurrent(storage, userId);
      if (!id) return;
      if (snapshot.shared) openAfterShared = id;
      else await open(id);
    },

    signOut() {
      autosave.stop();
      openAfterShared = null;
      update({ ...INITIAL, shared: snapshot.shared });
    },

    /** A registered part changed. */
    changed() {
      if (snapshot.current && !snapshot.shared) autosave.changed();
    },

    /** Saves pending changes now: back online, or the page closing. */
    flush({ pageClosing = false } = {}) {
      if (!snapshot.current || snapshot.shared) return Promise.resolve();
      closing = pageClosing;
      return autosave.flush().finally(() => {
        closing = false;
      });
    },

    open,
    refreshList,
    saveAs,

    /** Save: refused with a conflict when the workspace changed elsewhere since this device last read it. */
    save: () => writeCurrentState({ overwrite: false }),
    /** The conflict's "keep mine". */
    overwrite: () => writeCurrentState({ overwrite: true }),
    /** The conflict's "use the saved one". */
    reload: () => (snapshot.current ? open(snapshot.current.id) : Promise.resolve(null)),

    async rename(id: string, name: string) {
      const { data, failure } = await api.update(id, { name }, '*');
      if (data && snapshot.current?.id === id) update({ current: toCurrent(data) });
      void refreshList();
      return failure ?? null;
    },

    async remove(id: string) {
      const { failure } = await api.remove(id);
      if (!failure || failure.status === 404) forget(id);
      void refreshList();
      return failure ?? null;
    },

    async share() {
      const current = snapshot.current;
      if (!current) return null;
      const { data, failure } = await api.share(current.id);
      if (data && snapshot.current?.id === current.id) update({ current: { ...snapshot.current, shareSlug: data.slug } });
      return failure ?? null;
    },

    async unshare() {
      const current = snapshot.current;
      if (!current) return null;
      const { failure } = await api.unshare(current.id);
      if ((!failure || failure.status === 404) && snapshot.current?.id === current.id) update({ current: { ...snapshot.current, shareSlug: null } });
      return failure ?? null;
    },

    /** The first-sign-in offer: imports once per device, and becomes the current workspace. */
    async acceptImport() {
      update({ offerImport: false });
      const pending = importOnce?.();
      if (!pending) return null;
      const { data, failure } = await pending;
      if (!data) return failure;
      becomeCurrent(data, data.state);
      void refreshList();
      return null;
    },

    declineImport() {
      markImportOffered(storage);
      update({ offerImport: false });
    },

    /** "Import from this device" in the menu, any time. */
    async importDevice() {
      const state = readDeviceState(storage);
      const { data, failure } = await api.create(IMPORTED_NAME, state);
      void refreshList();
      return data ?? failure;
    },

    async viewShared(slug: string, at: number | null) {
      const { data, failure } = await api.shared(slug);
      const state = data ? readState(data.state) : null;
      if (!data || !state) {
        update({ problem: failure ?? unreadable });
        return failure ?? unreadable;
      }
      if (snapshot.current && !snapshot.shared) {
        await autosave.flush();
        openAfterShared = snapshot.current.id;
      }
      autosave.stop();
      if (!snapshot.shared) {
        before = parts.capture();
        backUpDevice(storage);
      }
      parts.apply(at === null ? state : { ...state, time: { mode: 'replay', t: at } }, { skip: PRIVATE_PARTS });
      update({ shared: { slug, name: data.name, at }, problem: null });
      return null;
    },

    async leaveShared() {
      if (!snapshot.shared) return;
      restoreDevice(storage);
      const back = before;
      const reopen = openAfterShared;
      before = null;
      openAfterShared = null;
      update({ shared: null });
      if (reopen) {
        await open(reopen);
        return;
      }
      if (back) parts.apply(back, { skip: PRIVATE_PARTS });
    },

    dismissProblem: () => update({ problem: null, conflict: null }),
  };
}

export type WorkspaceSession = ReturnType<typeof createWorkspaceSession>;

let session: WorkspaceSession | null = null;

/** The page's one session; browser only. */
export function workspaceSession(): WorkspaceSession {
  session ??= createWorkspaceSession({ storage: window.localStorage });
  return session;
}

export const INITIAL_SNAPSHOT = INITIAL;
