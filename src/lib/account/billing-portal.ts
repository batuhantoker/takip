/** The payment provider's page for managing a subscription (apps/api/src/billing/routes.ts). */
export async function billingPortalUrl(): Promise<{ url: string; failure?: undefined } | { failure: string }> {
  try {
    const res = await fetch('/api/billing/portal', { method: 'POST', cache: 'no-store' });
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && body.url) return { url: body.url };
    return { failure: body.error ?? `http_${res.status}` };
  } catch {
    return { failure: 'network' };
  }
}
