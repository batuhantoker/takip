/**
 * ISS streams that are live, playable and embeddable. Most "24/7 ISS" streams
 * fail one of the three (NASA's own ids are unplayable, several mirrors refuse
 * embedding), which is why the list is short. Sen leads: it runs its own 4K
 * cameras on the station; the other two are re-broadcasts on one channel.
 */
export interface IssFeed {
  id: 'sen-4k' | 'iss-earth' | 'iss-overview';
  label: string;
  detail: string;
  videoId: string;
}

export const ISS_FEEDS: IssFeed[] = [
  { id: 'sen-4k', label: '4K Earth', detail: 'Sen’s 4K cameras on the station', videoId: 'fO9e9jnhYK8' },
  { id: 'iss-earth', label: 'Earth view', detail: 'External camera looking straight down', videoId: 'tj4knR4r1UU' },
  { id: 'iss-overview', label: 'Overview', detail: 'Wide external camera', videoId: 'OKQEMp2555A' },
];

/** About where the station flies; the only "location" these cameras have. */
export const ISS_ALT_KM = 408;
export const ISS_ORBIT_MIN = 93;

/** YouTube picks quality from the player's rendered size; `vq` only nudges the large player. */
export function issEmbedSrc(videoId: string, big: boolean): string {
  const params = new URLSearchParams({ autoplay: '1', mute: '1', playsinline: '1', modestbranding: '1', rel: '0' });
  if (big) params.set('vq', 'hd1080');
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
