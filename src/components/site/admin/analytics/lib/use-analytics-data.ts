import { useState } from 'react';
import { useAdminData } from '@/components/site/admin/admin-api';

export type AnalyticsQuery<T> = { data?: T; error?: string; stale: boolean; reload: () => void };

/** useAdminData that keeps the last answer on screen while a new range loads, so charts dim instead of flashing. */
export function useAnalyticsData<T>(path: string): AnalyticsQuery<T> {
  const { data, error, loading, reload } = useAdminData<T>(path);
  const [kept, setKept] = useState<T | undefined>(data);
  if (data !== undefined && data !== kept) setKept(data);
  return { data: data ?? kept, error, stale: loading && kept !== undefined, reload };
}
