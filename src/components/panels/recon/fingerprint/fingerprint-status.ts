import type { DotTone } from '@/components/ui/tag';
import type { Tone } from '@/components/ui/class-names';
import { msg } from '@/lib/core/i18n/translator';
import type { RowStatus } from '@/lib/intel/recon/fingerprint/rows';
import type { Category, SearchType } from '@/lib/intel/recon/fingerprint/search';
import type { MatchTier } from '@/lib/intel/recon/people/correlate';

/** Token tone and a sentence-case label for each sweep verdict (the lib keeps hex colours we don't use here). */
export const STATUS_DISPLAY: Record<RowStatus, { label: string; tone: DotTone }> = {
  verified: { label: msg('Found'), tone: 'green' },
  verifying: { label: msg('Checking'), tone: 'accent' },
  unverifiable: { label: msg('Unsure'), tone: 'amber' },
  blocked: { label: msg('Blocked'), tone: 'muted' },
  unreliable: { label: msg('Can’t tell'), tone: 'muted' },
  error: { label: msg('No answer'), tone: 'red' },
};

/** How a hit ties to the person the others describe. */
export const MATCH_DISPLAY: Record<MatchTier, { label: string; tone: Tone }> = {
  confirmed: { label: msg('Verified link'), tone: 'green' },
  linked: { label: msg('Linked'), tone: 'green' },
  likely: { label: msg('Likely same'), tone: 'accent' },
  unknown: { label: msg('Unconnected'), tone: 'neutral' },
  other: { label: msg('Someone else?'), tone: 'amber' },
};

export const SEARCH_TYPE_LABEL: Record<SearchType, string> = { username: msg('Username'), email: msg('Email'), phone: msg('Phone') };

export const CATEGORY_LABEL: Record<Category, string> = {
  Social: msg('Social'), Developer: msg('Developer'), Gaming: msg('Gaming'), Video: msg('Video'), Music: msg('Music'),
  Creative: msg('Creative'), Writing: msg('Writing'), Lifestyle: msg('Lifestyle'), Commerce: msg('Commerce'),
  Forums: msg('Forums'), Other: msg('Other'),
};
