/**
 * Camera verbs TI can use: zoom by a step, tilt, turn, face north, slide a screen, show the whole
 * Earth, or orbit slowly round the centre. One motion at a time; any touch, wheel or key from the
 * reader cancels an orbit. After God's Eye View's camera verbs (src/cameraVerbs.js, MIT).
 */
import type { Map as MlMap } from 'maplibre-gl';

export interface CameraVerb {
  zoomBy?: number;
  tilt?: number;
  rotateBy?: number;
  northUp?: boolean;
  pan?: 'north' | 'south' | 'east' | 'west';
  /** Seconds to orbit round the centre. */
  orbit?: number;
  world?: boolean;
  stop?: boolean;
}

export interface CameraVerbs {
  run(v: CameraVerb): string;
  stop(): void;
  destroy(): void;
}

/** Degrees a second: a full turn in two minutes. */
const ORBIT_RATE = 3;
const EASE = { duration: 1200, essential: true } as const;
const MARK = { takipVerb: true };

export function createCameraVerbs(map: MlMap): CameraVerbs {
  let frame = 0;
  let orbitUntil = 0;
  const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    orbitUntil = 0;
  };
  const onInput = () => { if (frame) stop(); };
  const canvas = map.getCanvasContainer();
  const events = ['mousedown', 'touchstart', 'wheel', 'keydown'] as const;
  for (const e of events) canvas.addEventListener(e, onInput, { passive: true });

  const orbit = (seconds: number) => {
    stop();
    orbitUntil = performance.now() + seconds * 1000;
    let last = performance.now();
    const tick = (now: number) => {
      if (now >= orbitUntil) { frame = 0; return; }
      map.setBearing(map.getBearing() + ((now - last) / 1000) * ORBIT_RATE, MARK);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  return {
    run(v) {
      if (v.stop) { stop(); return 'Stopped moving'; }
      const done: string[] = [];
      const to: { zoom?: number; pitch?: number; bearing?: number; center?: [number, number] } = {};
      if (v.world) {
        to.zoom = 1.6;
        to.pitch = 0;
        done.push('the whole Earth');
      }
      if (v.zoomBy) {
        to.zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), (to.zoom ?? map.getZoom()) + v.zoomBy));
        done.push(`zoom ${to.zoom.toFixed(1)}`);
      }
      if (v.tilt !== undefined) {
        to.pitch = Math.max(0, Math.min(map.getMaxPitch(), v.tilt));
        done.push(`tilted to ${Math.round(to.pitch)}°`);
      }
      if (v.northUp) {
        to.bearing = 0;
        done.push('north up');
      } else if (v.rotateBy) {
        to.bearing = map.getBearing() + v.rotateBy;
        done.push(`turned ${Math.round(v.rotateBy)}°`);
      }
      if (v.pan) {
        const { width, height } = map.getCanvas().getBoundingClientRect();
        const [dx, dy] = { north: [0, -height * 0.6], south: [0, height * 0.6], east: [width * 0.6, 0], west: [-width * 0.6, 0] }[v.pan];
        const c = map.unproject([width / 2 + dx, height / 2 + dy]);
        to.center = [c.lng, c.lat];
        done.push(`panned ${v.pan}`);
      }
      if (Object.keys(to).length) {
        stop();
        if (reduced()) map.jumpTo(to, MARK); else map.easeTo({ ...to, ...EASE }, MARK);
      }
      if (v.orbit) {
        const s = Math.max(5, Math.min(120, v.orbit));
        if (reduced()) done.push('no orbit: the reader asked for reduced motion');
        else {
          // Start after the ease above, so the two do not fight over the bearing.
          if (map.isMoving()) map.once('moveend', () => orbit(s)); else orbit(s);
          done.push(`orbiting for ${Math.round(s)} s`);
        }
      }
      return done.length ? `Camera: ${done.join(', ')}` : '';
    },
    stop,
    destroy() {
      stop();
      for (const e of events) canvas.removeEventListener(e, onInput);
    },
  };
}
