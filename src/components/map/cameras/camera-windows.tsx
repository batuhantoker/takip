'use client';

import { useEffect, useState } from 'react';
import { FloatingWindow, playingIds, useWindows, windowStore } from '@/components/map/windows';
import { useRing } from '@/components/map/inspect/rings';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import CameraViewer from './camera-viewer';

/* eslint-disable @typescript-eslint/no-explicit-any -- cameras arrive untyped from every source */
type Camera = any;

const windowId = (c: Camera) => `camera:${c.id}`;

/**
 * The page names one camera at a time; each one it names gets a window and keeps it until
 * closed. Only the frontmost few play. A phone keeps the single player on its bottom bar.
 */
export default function CameraWindows({ camera, onClose, onLocate }: {
  camera: Camera | null;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState<Camera[]>([]);
  const [named, setNamed] = useState<Camera | null>(null);
  if (camera !== named) {
    setNamed(camera);
    if (camera?.id != null && !open.some(c => c.id === camera.id)) setOpen([...open, camera]);
  }
  // Named again while open: bring it forward.
  useEffect(() => { if (camera?.id != null) windowStore.expand(windowId(camera)); }, [camera]);

  const { list } = useWindows();
  const playing = playingIds(list);

  if (isMobile) return <CameraViewer camera={camera} onClose={onClose} onLocate={onLocate} />;

  const close = (c: Camera) => {
    setOpen(prev => prev.filter(p => p.id !== c.id));
    if (camera?.id === c.id) onClose();
  };
  return (
    <>
      {open.map(c => (
        <CameraWindow key={c.id} camera={c} playing={playing.has(windowId(c))} onClose={() => close(c)} onLocate={onLocate} />
      ))}
    </>
  );
}

function CameraWindow({ camera, playing, onClose, onLocate }: { camera: Camera; playing: boolean; onClose: () => void; onLocate?: (lat: number, lng: number) => void }) {
  const id = windowId(camera);
  useRing(id, { lat: camera.lat, lng: camera.lng });
  return (
    <FloatingWindow id={id} kind="camera" label={`Camera: ${camera.name}`} onClose={onClose}>
      <CameraViewer camera={camera} onClose={onClose} onLocate={onLocate} windowed playing={playing} onPlay={() => windowStore.focus(id)} />
    </FloatingWindow>
  );
}
