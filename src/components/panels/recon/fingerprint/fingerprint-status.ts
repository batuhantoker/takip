import type { DotTone } from '@/components/ui/tag';
import type { RowStatus } from '@/lib/recon/fingerprint-rows';

/** Token tone and a sentence-case label for each sweep verdict (the lib keeps hex colours we don't use here). */
export const STATUS_DISPLAY: Record<RowStatus, { label: string; tone: DotTone }> = {
  verified: { label: 'Found', tone: 'green' },
  verifying: { label: 'Checking', tone: 'accent' },
  unverifiable: { label: 'Unsure', tone: 'amber' },
  blocked: { label: 'Blocked', tone: 'muted' },
  error: { label: 'No answer', tone: 'red' },
};
