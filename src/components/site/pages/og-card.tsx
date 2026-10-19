import { WORDMARK } from '@/components/shell/brand/geometry.generated';
import { WORLD_LAND_PATH } from '@/lib/platform/site/world-land.generated';

// Satori can't read CSS variables, so the design tokens are repeated here by value.
const INK = { surface0: '#0A0C0F', land: '#2A3038', ink1: '#ECEEF0', ink2: '#A4AAB2', ink3: '#6D737B', accent: '#52C1D6' };

export const OG_SIZE = { width: 1200, height: 630 };

/** The world fills the card: 360° across 1200 px, so 180° of latitude takes 600 of the 630. */
const SCALE = OG_SIZE.width / 360;
const PAD = (OG_SIZE.height / SCALE - 180) / 2;
const at = (lat: number, lon: number) => ({ x: (lon + 180) * SCALE, y: (90 - lat + PAD) * SCALE });
/** The wordmark's corner, where a dot would read as part of the logo. */
const underHeader = (p: { lat: number; lon: number }) => { const { x, y } = at(p.lat, p.lon); return x < 440 && y < 140; };

/**
 * A share card: the wordmark, what the link shows, and the world behind it with the places it opens at.
 * Rendered by next/og (Satori): flexbox only, and every div with several children sets display.
 */
export function OgCard({ kicker, title, subtitle, points = [], focus = null, background = null, font = 'Geist' }: {
  kicker: string;
  title: string;
  subtitle: string;
  /** Places drawn as small dots, such as a layer page's suggested spots. */
  points?: { lat: number; lon: number }[];
  /** The place a link opens at, drawn as a ringed marker. */
  focus?: { lat: number; lon: number } | null;
  /** A picture of the map (data URI) to draw behind the words instead of the world outline. */
  background?: string | null;
  /** Font families to try in order, for scripts Geist doesn't cover. */
  font?: string;
}) {
  const f = focus ? at(focus.lat, focus.lon) : null;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: INK.surface0, position: 'relative', fontFamily: font }}>
      {background && (
        // eslint-disable-next-line @next/next/no-img-element -- Satori draws plain img elements.
        <img src={background} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: 'absolute', left: 0, top: 0, objectFit: 'cover' }} />
      )}
      {!background && <svg width={OG_SIZE.width} height={OG_SIZE.height} viewBox={`0 ${-PAD} 360 ${180 + PAD * 2}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d={WORLD_LAND_PATH} fill={INK.land} />
      </svg>}
      <div style={{ position: 'absolute', left: 0, top: 0, width: OG_SIZE.width, height: OG_SIZE.height, display: 'flex',
        backgroundImage: background
          ? `linear-gradient(90deg, rgba(10,12,15,0.94) 0%, rgba(10,12,15,0.78) 45%, rgba(10,12,15,0.15) 85%)`
          : `linear-gradient(90deg, ${INK.surface0} 0%, rgba(10,12,15,0.8) 42%, rgba(10,12,15,0) 78%)` }} />
      {/* The places go over the shade, so they read at full strength wherever they fall. */}
      <svg width={OG_SIZE.width} height={OG_SIZE.height} viewBox={`0 ${-PAD} 360 ${180 + PAD * 2}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {!background && points.filter(p => !underHeader(p)).map(p => <circle key={`${p.lat},${p.lon}`} cx={p.lon + 180} cy={90 - p.lat} r={2.2} fill={INK.accent} />)}
      </svg>
      {f && (
        <div style={{ position: 'absolute', left: f.x - 20, top: f.y - 20, width: 40, height: 40, borderRadius: 20,
          border: `3px solid ${INK.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: INK.accent }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 72px', width: 1000, height: '100%', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width={121} height={28} viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} fill={INK.ink1}>
            <path d={WORDMARK.d} />
            <path d={WORDMARK.ring} fillRule="evenodd" />
          </svg>
          <div style={{ fontSize: 26, color: INK.ink3, marginLeft: 22 }}>{kicker}</div>
        </div>
        <div style={{ fontSize: title.length > 40 ? 60 : 72, lineHeight: 1.06, color: INK.ink1, marginTop: 'auto', letterSpacing: '-0.02em' }}>{title}</div>
        <div style={{ fontSize: 30, lineHeight: 1.35, color: INK.ink2, marginTop: 24 }}>{subtitle}</div>
      </div>
    </div>
  );
}
