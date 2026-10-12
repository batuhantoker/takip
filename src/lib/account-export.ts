/** The signed-in user's data as a JSON file (apps/api/src/privacy/routes.ts). */
export type AccountExportResult = { text: string; filename: string; failure?: undefined } | { failure: string };

const FALLBACK_NAME = 'account.json';

export async function fetchAccountExport(): Promise<AccountExportResult> {
  try {
    const res = await fetch('/api/v1/account/export', { cache: 'no-store' });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { failure: body.error ?? `http_${res.status}` };
    }
    const filename = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? FALLBACK_NAME;
    return { text: await res.text(), filename };
  } catch {
    return { failure: 'network' };
  }
}
