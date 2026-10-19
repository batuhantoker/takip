import { msg } from '@/lib/core/i18n/translator';

/**
 * The sidebar and the phone bar give a label about 47px, so a language can use a shorter word there than in panel
 * titles. Without its own entry, a rail key shows the plain label's translation.
 */
const RAIL: Record<string, string> = {
  Layers: msg('rail|Layers'),
  Alerts: msg('rail|Alerts'),
  Areas: msg('rail|Areas'),
  History: msg('rail|History'),
  Space: msg('rail|Space'),
  Route: msg('rail|Route'),
  Recon: msg('rail|Recon'),
  More: msg('rail|More'),
};

export const railLabel = (label: string) => RAIL[label] ?? label;
