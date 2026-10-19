'use client';

import { useCallback, useState } from 'react';
import { countAction } from '@/lib/platform/usage-actions';

/** The region dossier a double right-click on the map asks for. */
export function useRegionDossier() {
  const [regionDossier, setRegionDossier] = useState<any>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  const openDossier = useCallback(async (coords: { lat: number; lng: number }) => {
    countAction('dossier.open');
    setDossierLoading(true); setRegionDossier(null);
    try {
      const res = await fetch(`/api/region-dossier?lat=${coords.lat}&lng=${coords.lng}`);
      if (res.ok) setRegionDossier(await res.json());
    } catch (e) { console.warn('[TAKIP] Suppressed error:', e instanceof Error ? e.message : e); } finally { setDossierLoading(false); }
  }, []);

  return { regionDossier, setRegionDossier, dossierLoading, setDossierLoading, openDossier };
}
