export const PROVIDER_LABELS = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple',
  microsoft: 'Microsoft',
  github: 'GitHub',
  twitter: 'X',
  discord: 'Discord',
} as const;

export type ProviderId = keyof typeof PROVIDER_LABELS;

export const PROVIDER_IDS = Object.keys(PROVIDER_LABELS) as ProviderId[];

export const isProviderId = (id: string): id is ProviderId => id in PROVIDER_LABELS;

/** Better Auth only connects a provider that confirms the email address, which Facebook never does. */
export const canConnect = (id: ProviderId) => id !== 'facebook';

let request: Promise<ProviderId[]> | null = null;

/** The providers the api has credentials for, asked once per page load. */
export function loadProviders() {
  request ??= fetch('/api/v1/auth/providers')
    .then(res => (res.ok ? (res.json() as Promise<{ providers: string[] }>) : { providers: [] }))
    .then(body => body.providers.filter(isProviderId))
    .catch(() => {
      request = null;
      return [];
    });
  return request;
}
