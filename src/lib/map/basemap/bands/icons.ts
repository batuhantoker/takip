import type * as maplibregl from 'maplibre-gl';
import { MAP_INK } from '@/lib/map/style/tokens';

// Create aircraft icon on canvas (for WebGL symbol layer)
export const createIcon = (map: maplibregl.Map, id: string, color: string, size: number) => {
  if (map.hasImage(id)) return;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.4);
  ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
  ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
  ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
  ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
  ctx.lineTo(cx, cy + size * 0.35);
  ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
  ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
  ctx.closePath();
  // A dark rim, half of it under the fill: lost on the dark map, an edge on imagery.
  ctx.strokeStyle = 'rgba(10,12,15,0.85)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
};

export const createDot = (map: maplibregl.Map, id: string, color: string, size: number) => {
  if (map.hasImage(id)) return;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
  ctx.fill();
  map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
};

export function addWarningIcons(map: maplibregl.Map) {
  // Warning icon generator (parameterized — eliminates 3x copy-paste)
  const createWarningIcon = (id: string, color: string) => {
    const s = 20;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s/2, 1);
    ctx.lineTo(s - 1, s - 1);
    ctx.lineTo(1, s - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', s/2, s - 4);
    map.addImage(id, { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) });
  };
  createWarningIcon('warn-icon', MAP_INK.red);
  createWarningIcon('warn-orange', MAP_INK.amber);
  createWarningIcon('warn-yellow', MAP_INK.sand);
}

export function addShipIcons(map: maplibregl.Map) {
  if (!map.hasImage('ship-arrow')) {
    const s = 24, c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(s / 2, 2); ctx.lineTo(s - 5, s - 3); ctx.lineTo(s / 2, s - 8); ctx.lineTo(5, s - 3); ctx.closePath(); ctx.fill();
    map.addImage('ship-arrow', { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) }, { sdf: true });
  }
  // A ship with no course gets a dot, not an arrow pointing north for no reason.
  if (!map.hasImage('ship-still')) {
    const s = 24, c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s / 2, s / 2, 5, 0, Math.PI * 2); ctx.fill();
    map.addImage('ship-still', { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) }, { sdf: true });
  }
}
