type PlaceLike = { country: string | null; region?: string | null; city?: string | null };

let regionNames: Intl.DisplayNames | null | undefined;

/** 'DE' → 'Germany'; the code itself where the browser has no name for it. */
export function countryName(code: string) {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Regional-indicator letters make the flag; null for anything but a two-letter code. */
export function flag(code: string | null | undefined) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "Frankfurt am Main, Hesse, Germany"; "Unknown place" when the database had no answer. */
export function placeText(place: PlaceLike | null | undefined) {
  if (!place || (!place.country && !place.city)) return 'Unknown place';
  const region = place.region && place.region !== place.city ? place.region : null;
  return [place.city, region, place.country ? countryName(place.country) : null].filter(Boolean).join(', ');
}

/** "Frankfurt am Main, Germany", for tight cells. */
export function placeShort(place: PlaceLike | null | undefined) {
  if (!place || (!place.country && !place.city)) return 'Unknown place';
  return [place.city, place.country ? countryName(place.country) : null].filter(Boolean).join(', ');
}
