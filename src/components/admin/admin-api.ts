import { useEffect, useState } from 'react';

/** Talks to the api's /api/admin routes through this origin's proxy. */

const lockListeners = new Set<() => void>();

/** The shell re-checks the gate when a request finds the console locked (the 12-hour unlock ran out). */
export function onLocked(listener: () => void) {
  lockListeners.add(listener);
  return () => {
    lockListeners.delete(listener);
  };
}

async function read<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (res.status === 403 && body.error === 'unlock_required') lockListeners.forEach(listener => listener());
  if (!res.ok) throw new Error(body.message ?? body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const adminGet = async <T>(path: string) => read<T>(await fetch(`/api/admin${path}`, { cache: 'no-store' }));

export async function adminSend(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) {
  return read<{ ok: true }>(await fetch(`/api/admin${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

export function useAdminData<T>(path: string) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    adminGet<T>(path)
      .then(data => live && setState({ path, data }))
      .catch((error: Error) => live && setState({ path, error: error.message }));
    return () => {
      live = false;
    };
  }, [path, version]);

  const current = state?.path === path ? state : null;
  return { data: current?.data, error: current?.error, loading: !current, reload: () => setVersion(v => v + 1) };
}
