import type { DotTone } from '@/components/ui/tag';
import type { Tone } from '@/components/ui/class-names';
import type { RowStatus } from '@/lib/recon/fingerprint-rows';
import type { MatchTier } from '@/lib/recon/people/correlate';

/** Token tone and a sentence-case label for each sweep verdict (the lib keeps hex colours we don't use here). */
export const STATUS_DISPLAY: Record<RowStatus, { label: string; tone: DotTone }> = {
  verified: { label: 'Found', tone: 'green' },
  verifying: { label: 'Checking', tone: 'accent' },
  unverifiable: { label: 'Unsure', tone: 'amber' },
  blocked: { label: 'Blocked', tone: 'muted' },
  unreliable: { label: 'Can’t tell', tone: 'muted' },
  error: { label: 'No answer', tone: 'red' },
};

/** How a hit ties to the person the others describe. */
export const MATCH_DISPLAY: Record<MatchTier, { label: string; tone: Tone }> = {
  confirmed: { label: 'Verified link', tone: 'green' },
  linked: { label: 'Linked', tone: 'green' },
  likely: { label: 'Likely same', tone: 'accent' },
  unknown: { label: 'Unconnected', tone: 'neutral' },
  other: { label: 'Someone else?', tone: 'amber' },
};
