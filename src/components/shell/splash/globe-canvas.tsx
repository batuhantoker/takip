'use client';

import { useEffect, useRef } from 'react';
import { createGlobeScene } from './globe-scene';

const READY_STAGE = 3;

/** The splash globe. `still` draws a single frame and redraws only on resize or a stage change. */
export function GlobeCanvas({ stage, still, className }: { stage: number; still: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef(stage);
  const repaintRef = useRef<() => void>(() => {});

  useEffect(() => {
    stageRef.current = stage;
    repaintRef.current();
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scene = createGlobeScene();
    const start = performance.now();
    let readyAt: number | null = null;
    let sized = false;
    let raf = 0;

    const paint = () => {
      if (!sized) return;
      const t = (performance.now() - start) / 1000;
      if (readyAt === null && stageRef.current >= READY_STAGE) readyAt = t;
      scene.draw(ctx, t, readyAt, still);
    };
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.resize(width, height, dpr);
      sized = true;
      paint();
    });
    observer.observe(canvas);
    if (still) repaintRef.current = paint;
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      repaintRef.current = () => {};
    };
  }, [still]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
