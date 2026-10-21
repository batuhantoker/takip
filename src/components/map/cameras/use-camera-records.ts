'use client';

import { useEffect, useState } from 'react';
import { cameraDetails, type CameraRecord } from '@/lib/feeds/cameras/camera-details';

/** The full records of these cameras, for a list that shows their names (the map's pins carry none). */
export function useCameraRecords(ids: readonly string[] | null): Map<string, CameraRecord> {
  const [records, setRecords] = useState<Map<string, CameraRecord>>(() => new Map());
  const key = ids?.join('\n') ?? '';
  useEffect(() => {
    if (!key) return;
    let live = true;
    void cameraDetails(key.split('\n')).then(found => { if (live) setRecords(found); });
    return () => { live = false; };
  }, [key]);
  return records;
}
