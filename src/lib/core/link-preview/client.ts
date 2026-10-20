import type { LinkPreview } from './parse';

/* Browser side. One answer per URL for the page's life, shared by the map popup
   and the Alerts panel, so opening a story twice asks once. */
const answers = new Map<string, Promise<LinkPreview | null>>();

export function loadLinkPreview(url: string): Promise<LinkPreview | null> {
  let answer = answers.get(url);
  if (!answer) {
    answer = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then(r => (r.ok ? r.json() as Promise<LinkPreview> : null))
      .catch(() => null);
    // A refused or failed lookup may succeed on the next open.
    answer.then(v => { if (!v) answers.delete(url); });
    answers.set(url, answer);
  }
  return answer;
}

/** The preview's picture, only when it is a web address an <img> may load. */
export const previewImage = (p: LinkPreview | null): string | null =>
  p?.image && /^https?:\/\//i.test(p.image) ? p.image : null;
