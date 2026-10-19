'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ClipboardPaste, Copy, RotateCcw } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Panel, PanelSection } from '@/components/ui/panel';
import { cx, ENTER, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { MAP_DEFAULTS, type MapPaletteKey } from '@/lib/map/style/palette';
import {
  applySettings, clearSettings, FONT_MONO, FONT_UI, loadSavedSettings, PRESETS, readTheme, sanitize, saveSettings, shade, type StyleSettings,
} from '@/lib/map/style/style-studio';
import { AutoSlider, ResettableSwatch, Row, sentence, Slider, SubHead, Swatch } from './style-studio-controls';

const pct = (v: number) => `${Math.round(v * 100)}%`;

const SATELLITES: [MapPaletteKey, string, string][] = [
  ['satComms', 'Comms', 'Comms satellites'], ['satMilitary', 'Military', 'Military satellites'], ['satNavigation', 'Navigation', 'Navigation satellites'],
  ['satEarth', 'Earth observation', 'Earth observation satellites'], ['satScience', 'Science', 'Science satellites'], ['satOther', 'Other', 'Other satellites'],
];
const AIRCRAFT: [MapPaletteKey, string, string][] = [
  ['flightCivil', 'Civil', 'Civil aircraft'], ['flightPrivate', 'Private', 'Private aircraft'], ['flightGov', 'Government', 'Government aircraft'],
  ['flightMilitary', 'Military', 'Military aircraft'], ['flightUnknown', 'Unknown', 'Unknown aircraft'],
];
const TI_ARCS: [MapPaletteKey, string, string][] = [
  ['aiSupport', 'Aligned', 'TI arcs: aligned or agreeing'], ['aiOppose', 'Opposed', 'TI arcs: opposed or disputing'], ['aiNeutral', 'Neutral', 'TI arcs: neutral, evidence'],
];

/**
 * Style Studio: every UI token on one card, live. The token maths lives in
 * `@/lib/map/style/style-studio`; this file is the controls and the wiring around them.
 */
function StyleStudio({ onClose, isMobile }: { onClose: () => void; isMobile?: boolean }) {
  const [s, setS] = useState<StyleSettings | null>(null);
  const [copied, setCopied] = useState(false);
  const initialised = useRef(false);
  /**
   * Until something changes there is nothing to override. Without this, Reset
   * would re-apply a snapshot of the current theme as inline vars, which look
   * identical but pin the palette, so the theme toggle would stop doing anything.
   */
  const dirty = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const saved = loadSavedSettings();
    if (saved) dirty.current = true;
    setS(saved ?? readTheme());
  }, []);

  useEffect(() => {
    if (!s || !dirty.current) return;
    applySettings(s);
    // Debounced: a slider drag fires this on every frame.
    const t = setTimeout(() => saveSettings(s), 250);
    return () => clearTimeout(t);
  }, [s]);

  /* While clean, re-seed from the live theme so edits made after a theme
     switch start from what is actually on screen. */
  const edit = useCallback((patch: Partial<StyleSettings> | ((base: StyleSettings) => Partial<StyleSettings>)) => {
    setS(prev => {
      const base = dirty.current && prev ? prev : readTheme();
      return { ...base, ...(typeof patch === 'function' ? patch(base) : patch) };
    });
    dirty.current = true;
  }, []);

  const set = useCallback(<K extends keyof StyleSettings>(key: K, value: StyleSettings[K]) => {
    edit({ [key]: value } as Partial<StyleSettings>);
  }, [edit]);

  // One layer colour at a time; the rest comes from the seeded base, not a copy that may predate a theme switch.
  const setMap = useCallback((key: MapPaletteKey, value: string) => {
    edit(base => ({ map: { ...base.map, [key]: value } }));
  }, [edit]);

  // The surface ramp follows the background unless a preset supplies its own.
  const setBg = useCallback((bg: string) => {
    edit({ bg, bgPrimary: shade(bg, 0.03), bgSecondary: shade(bg, 0.07), bgTertiary: shade(bg, 0.12) });
  }, [edit]);

  const reset = () => {
    dirty.current = false;
    clearSettings();
    applySettings(null);
    setS(readTheme());
  };

  const copy = async () => {
    if (!s) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(s, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  const paste = async () => {
    try {
      edit(sanitize(JSON.parse(await navigator.clipboard.readText()), s ?? readTheme()));
    } catch { /* not JSON, or clipboard blocked */ }
  };

  if (!s) return null;
  const mapRows = (rows: [MapPaletteKey, string, string][]) => rows.map(([key, label, aria]) => (
    <Row key={key} label={label}><ResettableSwatch label={aria} value={s.map[key]} fallback={MAP_DEFAULTS[key]} onChange={v => setMap(key, v)} /></Row>
  ));

  // Portalled: a transformed ancestor would otherwise position this fixed card against itself.
  return createPortal(
    <div className={cx(
      'fixed z-[400] flex',
      isMobile ? 'inset-x-3 top-20 bottom-3' : 'right-[var(--beside-controls,62px)] bottom-[calc(var(--shell-bottom,var(--shell-foot,28px))+12px)] h-[min(720px,calc(100vh-92px))] w-[340px]',
      ENTER, 'starting:translate-y-1',
    )}>
      <Panel docked={false} title="Style studio" subtitle="Live, and saved in this browser" onClose={onClose} className="w-full"
        actions={<>
          <IconButton label="Paste a theme" icon={ClipboardPaste} onClick={paste} />
          <IconButton label={copied ? 'Copied' : 'Copy this theme'} icon={copied ? Check : Copy} onClick={copy} />
          <IconButton label="Back to the theme" icon={RotateCcw} onClick={reset} />
        </>}>
        <PanelSection title="Preset">
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map(p => (
              <button key={p.label} type="button" onClick={() => edit(p.patch)}
                className={cx('flex h-8 items-center gap-2 rounded-control border border-line bg-surface-2 px-2 text-small text-ink-2 hover:border-line-strong hover:text-ink-1', FOCUS_RING, TRANSITION)}>
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: p.patch.accent }} />
                <span className="truncate">{sentence(p.label)}</span>
              </button>
            ))}
          </div>
        </PanelSection>

        <PanelSection title="Accent">
          <Row label="Primary"><Swatch label="Primary accent" value={s.accent} onChange={v => set('accent', v)} /></Row>
          <Row label="TI"><Swatch label="TI colour" value={s.accent2} onChange={v => set('accent2', v)} /></Row>
          <Row label="Glow"><Slider label="Glow strength" value={s.glow} min={0} max={1} step={0.01} onChange={v => set('glow', v)} format={pct} /></Row>
        </PanelSection>

        <PanelSection title="Status">
          <Row label="Critical"><Swatch label="Critical colour" value={s.alertRed} onChange={v => set('alertRed', v)} /></Row>
          <Row label="Warning"><Swatch label="Warning colour" value={s.alertOrange} onChange={v => set('alertOrange', v)} /></Row>
          <Row label="Healthy"><Swatch label="Healthy colour" value={s.alertGreen} onChange={v => set('alertGreen', v)} /></Row>
          <Row label="Information"><Swatch label="Information colour" value={s.alertBlue} onChange={v => set('alertBlue', v)} /></Row>
        </PanelSection>

        <PanelSection title="Map layers" hint="presets leave these alone">
          <SubHead label="Cameras" />
          <Row label="Dots and labels"><ResettableSwatch label="Camera colour" value={s.map.cctv} fallback={MAP_DEFAULTS.cctv} onChange={v => setMap('cctv', v)} /></Row>
          <SubHead label="Satellites" note="The default keeps each satellite's own mission colour; change one and it takes over that category." />
          {mapRows(SATELLITES)}
          <SubHead label="Aircraft" />
          {mapRows(AIRCRAFT)}
          <SubHead label="TI" note="The arcs a forecast draws through the sky." />
          {mapRows(TI_ARCS)}
        </PanelSection>

        <PanelSection title="Surface">
          <Row label="Background"><Swatch label="Background colour" value={s.bg} onChange={setBg} /></Row>
          <Row label="Panel opacity"><Slider label="Panel opacity" value={s.panelAlpha} min={0.2} max={1} step={0.01} onChange={v => set('panelAlpha', v)} format={pct} /></Row>
          <Row label="Borders"><Slider label="Border strength" value={s.borderAlpha} min={0} max={0.6} step={0.01} onChange={v => set('borderAlpha', v)} format={pct} /></Row>
          <Row label="Blur"><AutoSlider label="Backdrop blur" value={s.blur} min={0} max={64} step={1} whenEnabled={24} onChange={v => set('blur', v)} format={v => `${v}px`} /></Row>
          <Row label="Corners"><Slider label="Corner radius" value={s.radius} min={0} max={2.5} step={0.05} onChange={v => set('radius', v)} format={v => `${v.toFixed(2)}×`} /></Row>
        </PanelSection>

        <PanelSection title="Text">
          <Row label="Primary"><Swatch label="Primary text" value={s.textPrimary} onChange={v => set('textPrimary', v)} /></Row>
          <Row label="Secondary"><Swatch label="Secondary text" value={s.textSecondary} onChange={v => set('textSecondary', v)} /></Row>
          <Row label="Muted"><Swatch label="Muted text" value={s.textMuted} onChange={v => set('textMuted', v)} /></Row>
          <Row label="Headings"><Swatch label="Heading text" value={s.textHeading} onChange={v => set('textHeading', v)} /></Row>
        </PanelSection>

        <PanelSection title="Type">
          <div className="flex flex-col gap-3">
            <Select label="Interface font" size="sm" value={s.fontUi} onChange={e => set('fontUi', e.target.value)}
              options={FONT_UI.map(f => ({ value: f.value, label: sentence(f.label) }))} />
            <Select label="Number font" size="sm" value={s.fontMono} onChange={e => set('fontMono', e.target.value)}
              options={FONT_MONO.map(f => ({ value: f.value, label: sentence(f.label) }))} />
          </div>
          <Row label="Number spacing"><AutoSlider label="Mono letter spacing" value={s.tracking} min={-0.05} max={0.4} step={0.005} whenEnabled={0.2} onChange={v => set('tracking', v)} format={v => `${v.toFixed(2)}em`} /></Row>
        </PanelSection>

        <PanelSection title="Motion and effects">
          <Row label="Speed"><Slider label="Motion speed" value={s.motion} min={0} max={2} step={0.05} onChange={v => set('motion', v)} format={v => (v === 0 ? 'Off' : `${v.toFixed(2)}×`)} /></Row>
          <Row label="Scanlines"><Slider label="Scanline overlay" value={s.scanlines} min={0} max={0.2} step={0.005} onChange={v => set('scanlines', v)} format={v => (v === 0 ? 'Off' : `${Math.round(v * 500)}%`)} /></Row>
          <Row label="Grain"><Slider label="Film grain overlay" value={s.grain} min={0} max={0.3} step={0.005} onChange={v => set('grain', v)} format={v => (v === 0 ? 'Off' : `${Math.round(v * 333)}%`)} /></Row>
          <Row label="Vignette"><Slider label="Edge vignette" value={s.vignette} min={0} max={1} step={0.01} onChange={v => set('vignette', v)} format={v => (v === 0 ? 'Off' : pct(v))} /></Row>
        </PanelSection>
      </Panel>
    </div>,
    document.body,
  );
}

export default memo(StyleStudio);
