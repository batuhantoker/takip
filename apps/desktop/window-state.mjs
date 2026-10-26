import { readFileSync, writeFileSync } from 'node:fs';
import { screen } from 'electron';

const DEFAULT = { width: 1440, height: 900 };

/** The last size and place, unless the display it was on is gone. */
export function loadBounds(file) {
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    const area = screen.getDisplayMatching(saved).workArea;
    const visible = saved.x < area.x + area.width && saved.x + saved.width > area.x && saved.y < area.y + area.height && saved.y + saved.height > area.y;
    return visible ? saved : { ...DEFAULT, maximized: saved.maximized };
  } catch {
    return DEFAULT;
  }
}

export function keepBounds(win, file) {
  let timer;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
      try {
        writeFileSync(file, JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
      } catch {
        // A read-only profile just forgets the size.
      }
    }, 400);
  };
  for (const event of ['resize', 'move', 'maximize', 'unmaximize']) win.on(event, save);
  win.on('close', save);
}
