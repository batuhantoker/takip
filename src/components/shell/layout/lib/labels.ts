import { msg } from '@/lib/core/i18n/translator';
import type { BarId, ControlId, Corner, OverlayId, RailId, StatusId } from '@/components/shell/layout/lib/model';

/** What each piece is called in Settings → Layout (the name it carries on screen where it has one), translated where it renders. */
export const RAIL_LABELS: Record<RailId, string> = {
  layers: msg('Layers'), alerts: msg('Alerts'), draw: msg('Areas'), history: msg('History'), space: msg('Space'), directions: msg('Route'), recon: msg('Recon'), arcgis: 'ArcGIS',
};

export const STATUS_LABELS: Record<StatusId, string> = {
  position: msg('Pointer position'), place: msg('Place name'), quake: msg('Latest quake'), live: msg('Live state'), tracked: msg('Tracked count'), clock: msg('UTC clock'), shortcuts: msg('Shortcuts button'),
};

export const OVERLAY_LABELS: Record<OverlayId, string> = {
  search: msg('Search'), showing: msg('Showing'), switcher: msg('Map | Space'), controls: msg('Map controls'), scale: msg('Scale'),
};

export const CONTROL_LABELS: Record<ControlId, string> = {
  zoom: msg('Zoom and compass'), globe: msg('Globe or flat'), basemap: msg('Base map'), replay: msg('Replay'),
};

export const CORNER_LABELS: Record<Corner, string> = {
  'top-left': msg('Top left'), 'top-right': msg('Top right'), 'bottom-left': msg('Bottom left'), 'bottom-right': msg('Bottom right'),
};

export const BAR_LABELS: Record<BarId, string> = {
  layers: msg('Layers'), intel: msg('Alerts'), history: msg('History'), space: msg('Space'), recon: msg('Recon'), ai: 'TI', search: msg('Search'), route: msg('Route'),
};
