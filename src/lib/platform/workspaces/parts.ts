import { PART_NAMES, STATE_VERSION, type PartName, type PartValue, type WorkspaceStateV1 } from './state';

/** How one piece of the page's state is read for saving and written back when a workspace opens. */
export type WorkspacePart<K extends PartName> = {
  /** undefined: nothing to save for this part right now. */
  get: () => PartValue<K> | undefined;
  set: (value: PartValue<K>) => void;
};

type AnyPart = { get: () => unknown; set: (value: never) => void };

/**
 * The bridge between the page and saved workspaces: the page registers its parts (layers, viewport, …);
 * capture reads them and apply writes them. A registered part wins over a fallback (one read from
 * localStorage). A value applied before any part could take it waits, is saved back meanwhile, and goes to
 * the part that registers for it.
 */
export function createPartRegistry() {
  const registered = new Map<PartName, AnyPart>();
  const fallbacks = new Map<PartName, AnyPart>();
  const pending = new Map<PartName, unknown>();
  const listeners = new Set<() => void>();

  const partOf = (name: PartName) => registered.get(name) ?? fallbacks.get(name);

  function write(part: AnyPart, value: unknown) {
    try {
      (part.set as (value: unknown) => void)(value);
    } catch (err) {
      // One part failing must not keep the others from opening.
      console.error('[workspaces] could not apply a part', err);
    }
  }

  return {
    register<K extends PartName>(name: K, part: WorkspacePart<K>, { fallback = false } = {}) {
      const table = fallback ? fallbacks : registered;
      table.set(name, part);
      if (!fallback && pending.has(name)) {
        const value = pending.get(name);
        pending.delete(name);
        write(part, value);
      }
      return () => {
        if (table.get(name) === part) table.delete(name);
      };
    },

    capture(): WorkspaceStateV1 {
      const state: Record<string, unknown> = { v: STATE_VERSION };
      for (const name of PART_NAMES) {
        const part = partOf(name);
        const value = part ? part.get() : pending.get(name);
        if (value !== undefined) state[name] = value;
      }
      return state as WorkspaceStateV1;
    },

    /** Parts the state lacks, or `skip` names, keep what they have. */
    apply(state: WorkspaceStateV1, { skip = [] }: { skip?: readonly PartName[] } = {}) {
      pending.clear();
      for (const name of PART_NAMES) {
        const value = state[name];
        if (value === undefined || skip.includes(name)) continue;
        const part = partOf(name);
        if (part) write(part, value);
        else pending.set(name, value);
      }
    },

    /** Parts call this when their value changes; autosave listens. */
    notify() {
      listeners.forEach(listener => listener());
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type PartRegistry = ReturnType<typeof createPartRegistry>;

const registry = createPartRegistry();

export const workspaceParts = registry;
export const registerWorkspacePart = registry.register;
export const notifyWorkspaceChanged = registry.notify;
