/**
 * Waymarked Trails' hiking overlay: OpenStreetMap hiking routes as transparent tiles.
 * Terms: CC BY-SA 3.0 DE; other sites may use it at moderate rates, no bulk download.
 */
export const HIKING_LAYER = 'hiking-routes';
export const HIKING_TILES = 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png';
/** Past this the server answers 404. */
export const HIKING_MAX_ZOOM = 18;
export const HIKING_ATTRIBUTION = '<a href="https://hiking.waymarkedtrails.org/" target="_blank" rel="noopener">Trails © Waymarked Trails</a> (CC BY-SA 3.0 DE), data © OpenStreetMap contributors';

/** The route API behind the overlay. Boxes and geometry are in EPSG:3857. */
export const WMT_API = 'https://hiking.waymarkedtrails.org/api/v1';
