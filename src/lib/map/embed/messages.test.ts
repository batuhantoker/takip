import { describe, expect, it } from 'vitest';
import { fromFrame, fromPage, wire } from './messages';

const ORIGIN = 'https://takip.dev';
const parent = {} as MessageEventSource;
const frame = {} as MessageEventSource;
const event = (data: unknown, source: MessageEventSource | null = parent, origin = ORIGIN) => ({ data, source, origin });
const louvre = { id: 'Q19675', lon: 2.3376, lat: 48.8606, label: 'Louvre' };

describe('fromPage', () => {
  it('reads marks, clears and flights', () => {
    expect(fromPage(event(wire({ type: 'mark', mark: { points: [louvre] } })), ORIGIN, parent)).toEqual({ type: 'mark', mark: { points: [louvre] } });
    expect(fromPage(event(wire({ type: 'mark', mark: { points: [louvre, louvre], route: true } })), ORIGIN, parent))
      .toEqual({ type: 'mark', mark: { points: [louvre, louvre], route: true } });
    expect(fromPage(event(wire({ type: 'mark', mark: null })), ORIGIN, parent)).toEqual({ type: 'mark', mark: null });
    expect(fromPage(event(wire({ type: 'fly', lon: 2.3, lat: 48.8, zoom: 15 })), ORIGIN, parent)).toEqual({ type: 'fly', lon: 2.3, lat: 48.8, zoom: 15 });
  });

  it('hears only its parent, on its own origin, on its channel', () => {
    const m = wire({ type: 'mark', mark: null });
    expect(fromPage(event(m, frame), ORIGIN, parent)).toBeNull();
    expect(fromPage(event(m, parent, 'https://example.com'), ORIGIN, parent)).toBeNull();
    expect(fromPage(event(m), ORIGIN, null)).toBeNull();
    expect(fromPage(event({ type: 'mark', mark: null }), ORIGIN, parent)).toBeNull();
  });

  it('refuses malformed marks', () => {
    const bad = [
      { points: [] },
      { points: [{ ...louvre, lat: 91 }] },
      { points: [{ ...louvre, lon: Number.NaN }] },
      { points: [{ ...louvre, id: '' }] },
      { points: [{ ...louvre, label: 'x'.repeat(121) }] },
      { points: Array(61).fill(louvre) },
      { points: 'Q19675' },
    ];
    for (const mark of bad) expect(fromPage(event(wire({ type: 'mark', mark } as never)), ORIGIN, parent)).toBeNull();
    expect(fromPage(event(wire({ type: 'fly', lon: 2, lat: 48, zoom: 30 })), ORIGIN, parent)).toBeNull();
  });
});

describe('fromFrame', () => {
  it('reads ready and clicks from its frame only', () => {
    expect(fromFrame(event(wire({ type: 'ready' }), frame), ORIGIN, frame)).toEqual({ type: 'ready' });
    expect(fromFrame(event(wire({ type: 'click', id: 'Q19675' }), frame), ORIGIN, frame)).toEqual({ type: 'click', id: 'Q19675' });
    expect(fromFrame(event(wire({ type: 'ready' }), parent), ORIGIN, frame)).toBeNull();
    expect(fromFrame(event(wire({ type: 'click', id: 7 } as never), frame), ORIGIN, frame)).toBeNull();
  });
});
