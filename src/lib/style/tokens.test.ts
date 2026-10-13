import { describe, it, expect } from 'vitest';
import { buildCss, buildVars, DEFAULTS, sanitize, type StyleSettings } from './tokens';
import { MAP_DEFAULTS, MAP_PALETTE_KEYS, MAP_VARS } from '@/lib/map/palette';

const settings = (o: Partial<StyleSettings> = {}): StyleSettings => ({ ...DEFAULTS, ...o });

describe('sanitize', () => {
  it('refuses colours that try to close the declaration and add rules', () => {
    // Settings reach an injected <style> tag and body.style, so an unvalidated
    // string pasted from the clipboard would be a CSS injection.
    const hostile = { accent: 'red; } body { display: none !important } .x {' };
    expect(sanitize(hostile, DEFAULTS).accent).toBe(DEFAULTS.accent);
  });

  it('refuses numbers smuggled in as strings with a CSS payload', () => {
    const hostile = { blur: '12px; } * { visibility: hidden } .y {', tracking: '0.1em } body::before { content: "x" } .z {' };
    const out = sanitize(hostile, DEFAULTS);
    // parseFloat salvages the leading number; the payload never survives.
    expect(out.blur).toBe(12);
    expect(out.tracking).toBe(0.1);
    expect(JSON.stringify(out)).not.toContain('visibility');
    expect(JSON.stringify(out)).not.toContain('content');
  });

  it('rejects a font stack outside the offered list', () => {
    const hostile = { fontUi: 'Comic Sans; } html { filter: invert(1) } x{' };
    expect(sanitize(hostile, DEFAULTS).fontUi).toBe(DEFAULTS.fontUi);
  });

  it('clamps numbers to their control range', () => {
    const out = sanitize({ radius: 9999, motion: -50, scanlines: 99, glow: 4, panelAlpha: 0 }, DEFAULTS);
    expect(out.radius).toBe(2.5);
    expect(out.motion).toBe(0);
    expect(out.scanlines).toBe(0.2);
    expect(out.glow).toBe(1);
    expect(out.panelAlpha).toBe(0.2);
  });

  it('falls back for values that are not numbers at all', () => {
    expect(sanitize({ panelAlpha: 'abc' }, DEFAULTS).panelAlpha).toBe(DEFAULTS.panelAlpha);
    expect(sanitize({ textPrimary: 'javascript:alert(1)' }, DEFAULTS).textPrimary).toBe(DEFAULTS.textPrimary);
  });

  it('keeps null as null, because null is the AUTO state', () => {
    // AUTO has to survive a save/load round trip or reopening the studio would
    // silently start overriding blur and tracking.
    const base = settings({ blur: 20, tracking: 0.1 });
    expect(sanitize({ blur: null, tracking: null }, base).blur).toBeNull();
    expect(sanitize({ blur: null, tracking: null }, base).tracking).toBeNull();
  });

  it('takes the base value when a key is absent', () => {
    const base = settings({ blur: 20, accent: '#123456' });
    const out = sanitize({}, base);
    expect(out.blur).toBe(20);
    expect(out.accent).toBe('#123456');
  });

  it('normalises the hex spellings a browser hands back', () => {
    // getComputedStyle returns `rgba(var(--x), .2)` as 8-digit hex.
    expect(sanitize({ accent: '#B388FF33' }, DEFAULTS).accent).toBe('#b388ff');
    expect(sanitize({ accent: '#ABC' }, DEFAULTS).accent).toBe('#aabbcc');
  });

  it('survives junk input without throwing', () => {
    expect(() => sanitize(null, DEFAULTS)).not.toThrow();
    expect(() => sanitize('not an object', DEFAULTS)).not.toThrow();
    expect(sanitize(null, DEFAULTS)).toEqual(DEFAULTS);
  });
});

describe('buildCss', () => {
  it('emits nothing when every knob is neutral', () => {
    // The whole point: opening the studio and nudging a colour must not
    // restyle radius, blur, tracking or motion as a side effect.
    expect(buildCss(DEFAULTS)).toBe('');
  });

  it('emits only the block for the knob that changed', () => {
    const css = buildCss(settings({ blur: 8 }));
    expect(css).toContain('backdrop-filter: blur(8px)');
    expect(css).not.toContain('border-radius');
    expect(css).not.toContain('letter-spacing');
    expect(css).not.toContain('transition-duration');
  });

  it('leaves tracking alone at AUTO and sets it when overridden', () => {
    expect(buildCss(settings({ tracking: null }))).not.toContain('letter-spacing');
    expect(buildCss(settings({ tracking: 0.2 }))).toContain('letter-spacing: 0.2em');
  });

  it('treats blur 0 as a real value, not as AUTO', () => {
    // 0 means "no blur", which is a legitimate choice and must be emitted.
    expect(buildCss(settings({ blur: 0 }))).toContain('blur(0px)');
  });

  it('scales the radius utilities but never the pill radius', () => {
    const css = buildCss(settings({ radius: 2 }));
    expect(css).toContain('.rounded-lg { border-radius: 16.0px; }');
    expect(css).toContain('.rounded-full { border-radius: 9999px; }');
  });

  it('scopes every rule to the studio attribute', () => {
    const css = buildCss(settings({ radius: 1.5, blur: 10, tracking: 0.1, motion: 0.5, scanlines: 0.1 }));
    for (const line of css.split('\n')) {
      if (line.trim().endsWith('{') || line.includes('} ')) {
        expect(line.includes('body[data-studio="on"]') || line.trim() === '{').toBe(true);
      }
    }
  });

  it('cannot be escaped by a sanitised hostile payload', () => {
    const hostile = sanitize(
      { blur: '1px } body { display: none } .x {', tracking: '0.1em } body::before { content: "PWNED" } .z {' },
      DEFAULTS,
    );
    const css = buildCss(hostile);
    expect(css).not.toContain('PWNED');
    expect(css).not.toContain('display: none');
  });
});

describe('buildVars', () => {
  it('derives the accent family from one colour', () => {
    const v = buildVars(settings({ accent: '#ff8800', glow: 0.5 }));
    expect(v['--accent']).toBe('#ff8800');
    expect(v['--accent-soft']).toBe('rgba(255, 136, 0, 0.12)');
    expect(v['--cyan-rgb']).toBe('255, 136, 0');
    expect(v['--cyan-glow']).toBe('rgba(255, 136, 0, 0.3)');
  });

  it('keeps TI gold on the second colour', () => {
    const v = buildVars(settings({ accent2: '#336699' }));
    expect(v['--gold']).toBe('#336699');
    expect(v['--gold-rgb']).toBe('51, 102, 153');
    expect(v['--on-gold']).toBe('#ffffff');
  });

  it('keeps borders neutral and the strong line stronger', () => {
    const v = buildVars(settings({ accent: '#ff8800', borderAlpha: 0.2 }));
    expect(v['--line']).toBe('rgba(255, 255, 255, 0.2)');
    expect(v['--line-strong']).toBe('rgba(255, 255, 255, 0.34)');
  });

  it('never lets a derived alpha exceed 1', () => {
    const v = buildVars(settings({ borderAlpha: 0.6 }));
    expect(v['--scrollbar-thumb-hover']).toBe('rgba(255, 255, 255, 1)');
  });

  it('keeps panels opaque by default', () => {
    expect(buildVars(DEFAULTS)['--bg-panel']).toBe('rgba(17, 19, 23, 1)');
  });

  it('uses the stored surface ramp rather than re-deriving it', () => {
    // The themes' ramps are hue-shifted, not plain lightening, so a derived
    // ramp would visibly flatten them the moment any control was touched.
    const v = buildVars(settings({ bg: '#05000f', bgPrimary: '#08001a', bgSecondary: '#0d0025', bgTertiary: '#140033' }));
    expect(v['--surface-0']).toBe('#05000f');
    expect(v['--surface-1']).toBe('#08001a');
    expect(v['--surface-2']).toBe('#0d0025');
    expect(v['--surface-3']).toBe('#140033');
  });

  it('covers every token the themes define, plus the literal legacy ones', () => {
    // A token the studio forgets is a token Reset cannot clean up.
    const names = Object.keys(buildVars(DEFAULTS));
    for (const required of [
      '--surface-0', '--surface-1', '--surface-2', '--surface-3', '--line', '--line-strong',
      '--ink-1', '--ink-2', '--ink-3', '--ink-4',
      '--accent', '--accent-soft', '--on-accent', '--gold', '--gold-soft', '--on-gold',
      '--red', '--amber', '--green', '--blue',
      '--gold-rgb', '--cyan-rgb', '--gold-glow', '--cyan-glow', '--bg-panel', '--text-heading',
      '--scrollbar-thumb', '--scrollbar-thumb-hover', '--hover-accent',
      '--font-hud', '--font-body',
    ]) {
      expect(names).toContain(required);
    }
  });
});

describe('map palette', () => {
  it('emits every map property so the map can read them back', () => {
    const v = buildVars(settings());
    for (const key of MAP_PALETTE_KEYS) {
      expect(v[MAP_VARS[key]]).toBe(MAP_DEFAULTS[key]);
    }
  });

  it('carries an edited layer colour through to its property', () => {
    const v = buildVars(settings({ map: { ...MAP_DEFAULTS, cctv: '#ff00ff' } }));
    expect(v['--map-cctv']).toBe('#ff00ff');
    expect(v['--map-sat-military']).toBe(MAP_DEFAULTS.satMilitary);
  });

  it('sanitises map colours like every other colour', () => {
    // These land on body.style as text, so the same injection rules apply.
    const hostile = { map: { cctv: 'red; } body { display: none } .x {', satEarth: '#0f0' } };
    const out = sanitize(hostile, DEFAULTS);
    expect(out.map.cctv).toBe(MAP_DEFAULTS.cctv);
    expect(out.map.satEarth).toBe('#00ff00');
    expect(JSON.stringify(out)).not.toContain('display');
  });

  it('survives a stored theme written before the map section existed', () => {
    const out = sanitize({ accent: '#ffffff' }, DEFAULTS);
    expect(out.map).toEqual(MAP_DEFAULTS);
  });
});

describe('screen overlays', () => {
  it('emits nothing while scanlines, vignette and grain are all off', () => {
    expect(buildCss(settings())).not.toContain('::after');
  });

  it('stacks them into one pseudo-element rather than overwriting', () => {
    // Two ::after rules would not compose — the later one simply wins.
    const css = buildCss(settings({ scanlines: 0.04, vignette: 0.5, grain: 0.1 }));
    expect(css.match(/::after/g)).toHaveLength(1);
    expect(css).toContain('repeating-linear-gradient');
    expect(css).toContain('radial-gradient');
    expect(css).toContain('data:image/svg+xml');
  });

  it('leaves out the layers that are off', () => {
    const css = buildCss(settings({ vignette: 0.4 }));
    expect(css).toContain('radial-gradient');
    expect(css).not.toContain('repeating-linear-gradient');
    expect(css).not.toContain('data:image/svg+xml');
  });

  it('percent-encodes the grain tile so it cannot break out of the url()', () => {
    const css = buildCss(settings({ grain: 0.2 }));
    expect(css).not.toContain('<svg');
    expect(css).toContain('%3Csvg');
  });

  it('clamps the new knobs', () => {
    const out = sanitize({ vignette: 12, grain: -3 }, DEFAULTS);
    expect(out.vignette).toBe(1);
    expect(out.grain).toBe(0);
  });
});
