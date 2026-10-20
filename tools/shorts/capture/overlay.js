// The short's own layer over the page: hook, counter, title, captions, watermark and end card.
// It keeps no time of its own; the renderer hands it each frame's state (timeline.ts frameAt).
// Platform buttons cover the bottom fifth and the right edge, so nothing that matters sits there.
(() => {
  const css = `
#shorts-overlay { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; color: #ECEEF0;
  font-family: var(--font-body), Geist, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
#shorts-overlay .scrim { position: absolute; left: 0; right: 0; top: 0; height: 34%;
  background: linear-gradient(rgba(10,12,15,.78), rgba(10,12,15,0)); }
#shorts-overlay .brand { position: absolute; left: 20px; top: 22px; display: flex; flex-direction: column; gap: 6px; }
#shorts-overlay .brand svg { height: 12px; width: auto; fill: #ECEEF0; opacity: .9; }
#shorts-overlay .credit { font-size: 11px; line-height: 1.3; color: #A4AAB2; max-width: 260px; }
#shorts-overlay .counter { position: absolute; left: 0; right: 0; top: 13%; text-align: center; transition: none; }
#shorts-overlay .counter b { display: block; font: 500 54px/1 var(--font-hud), 'Geist Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums; color: #52C1D6; letter-spacing: -0.02em; }
#shorts-overlay .counter b.date { font-size: 34px; letter-spacing: -0.01em; }
#shorts-overlay .counter span { display: block; margin-top: 6px; font-size: 15px; color: #A4AAB2; }
#shorts-overlay .counter span.before { margin: 0 0 6px; }
#shorts-overlay .title { position: absolute; left: 36px; right: 36px; top: 27%; text-align: center;
  font-size: 26px; line-height: 1.15; font-weight: 600; letter-spacing: -0.01em; text-shadow: 0 2px 12px rgba(0,0,0,.6); }
#shorts-overlay .hook { position: absolute; left: 32px; right: 32px; top: 34%; text-align: center; }
#shorts-overlay .hook i { display: inline-flex; align-items: center; gap: 8px; font: 500 14px/1 var(--font-hud), 'Geist Mono', monospace;
  font-style: normal; color: #52C1D6; }
#shorts-overlay .hook i::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #52C1D6; }
#shorts-overlay .hook p { margin: 14px 0 0; font-size: 34px; line-height: 1.12; font-weight: 650; letter-spacing: -0.02em;
  text-shadow: 0 2px 18px rgba(0,0,0,.7); }
#shorts-overlay .caption { position: absolute; left: 40px; right: 40px; top: 63%; display: flex; justify-content: center; }
#shorts-overlay .caption div { padding: 10px 16px; border-radius: 14px; background: rgba(10,12,15,.66);
  backdrop-filter: blur(8px); font-size: 25px; line-height: 1.22; font-weight: 650; text-align: center; letter-spacing: -0.01em; }
#shorts-overlay .caption .w2 { color: rgba(236,238,240,.5); }
#shorts-overlay .caption .w1 { color: #52C1D6; }
#shorts-overlay .end { position: absolute; inset: 0; background: rgba(10,12,15,.9); display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; padding: 0 36px 18%; text-align: center; }
#shorts-overlay .end svg { height: 30px; width: auto; fill: #ECEEF0; }
#shorts-overlay .end p { margin: 0; font-size: 24px; line-height: 1.2; font-weight: 600; }
#shorts-overlay .end em { font-style: normal; font-size: 15px; color: #A4AAB2; }
#shorts-overlay .end b { font: 500 30px/1 var(--font-hud), 'Geist Mono', monospace; color: #52C1D6; }
#shorts-overlay .end small { margin-top: 10px; font-size: 11px; color: #6D737B; max-width: 320px; }
#shorts-overlay .tap { position: absolute; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
  border: 2px solid #52C1D6; background: rgba(82,193,214,.22); }
#shorts-overlay .legend { position: absolute; left: 50%; top: 54%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;
  gap: 5px; padding: 8px 12px; border-radius: 10px; background: rgba(10,12,15,.66); backdrop-filter: blur(8px); }
#shorts-overlay .legend em { font-style: normal; font-size: 12px; color: #A4AAB2; }
#shorts-overlay .legend i { display: block; width: 200px; height: 8px; border-radius: 4px; }
#shorts-overlay .legend span { display: flex; justify-content: space-between; width: 200px; font: 500 11px/1 var(--font-hud), 'Geist Mono', monospace; color: #A4AAB2; }
#shorts-overlay [hidden] { display: none !important; }
`;
  const el = (tag, cls, parent) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    parent.appendChild(e);
    return e;
  };
  let parts = null;
  let config = null;
  let lastCaption = '';

  window.__shortsOverlay = {
    init(cfg) {
      config = cfg;
      document.getElementById('shorts-overlay')?.remove();
      const style = document.createElement('style');
      style.textContent = css + (cfg.mapOnly ? `
body * { visibility: hidden !important; }
.maplibregl-map, .maplibregl-map *, #shorts-overlay, #shorts-overlay * { visibility: visible !important; }
.maplibregl-control-container, .maplibregl-popup { display: none !important; }` : '');
      document.head.appendChild(style);
      const root = el('div', '', document.body);
      root.id = 'shorts-overlay';
      root.lang = cfg.lang;
      const mark = `<svg viewBox="0 0 ${cfg.wordmark.width} ${cfg.wordmark.height}"><path d="${cfg.wordmark.d}"/><path d="${cfg.wordmark.ring}" fill-rule="evenodd"/></svg>`;
      const scrim = el('div', 'scrim', root);
      const brand = el('div', 'brand', root);
      brand.innerHTML = mark;
      const credit = el('div', 'credit', brand);
      credit.textContent = cfg.credit;
      const counter = el('div', 'counter', root);
      counter.dir = cfg.rtl ? 'rtl' : 'ltr';
      // the unit's words go round the number as the language orders them: "hace" above, "millones de años" below
      const before = el('span', 'before', counter);
      const value = el('b', '', counter);
      const unit = el('span', '', counter);
      const title = el('div', 'title', root);
      const hook = el('div', 'hook', root);
      const kicker = el('i', '', hook);
      const hookLine = el('p', '', hook);
      const caption = el('div', 'caption', root);
      const words = el('div', '', caption);
      const end = el('div', 'end', root);
      end.innerHTML = mark;
      const endLine = el('p', '', end);
      const explore = el('em', '', end);
      const url = el('b', '', end);
      url.textContent = 'takip.dev';
      const sources = el('small', '', end);
      sources.textContent = cfg.sources;
      for (const e of [title, hook, caption, end]) e.dir = cfg.rtl ? 'rtl' : 'ltr';
      const tap = el('div', 'tap', root);
      const legend = el('div', 'legend', root);
      const legendLabel = el('em', '', legend);
      const legendBar = el('i', '', legend);
      const legendEnds = el('span', '', legend);
      if (cfg.legend) {
        legendLabel.textContent = cfg.legend.label;
        legendBar.style.background = `linear-gradient(90deg, ${cfg.legend.ramp.join(', ')})`;
      }
      // the app's own bar carries the brand; a scrim would dim the interface being shown
      scrim.hidden = !cfg.mapOnly;
      parts = { scrim, brand, counter, before, value, unit, title, hook, kicker, hookLine, caption, words, end, endLine, explore, tap, legend, legendEnds };
    },

    /** frame: timeline.ts OverlayFrame plus `count` (the counter's number, or null). */
    draw(frame) {
      const p = parts;
      p.hook.hidden = frame.card !== 'hook';
      if (frame.hook) {
        p.hook.style.opacity = frame.cardIn;
        p.hook.style.transform = `translateY(${(1 - frame.cardIn) * 12}px)`;
        p.kicker.textContent = frame.hook.kicker;
        p.hookLine.textContent = frame.hook.line;
      }
      p.end.hidden = frame.card !== 'end';
      if (frame.end) {
        p.end.style.opacity = frame.cardIn;
        p.endLine.textContent = frame.end.line;
        p.explore.textContent = frame.end.explore;
      }
      p.brand.hidden = frame.card === 'end' || !config.mapOnly;
      p.legend.hidden = !config.legend || !frame.legend || !!frame.card;
      if (!p.legend.hidden) {
        const fmt = new Intl.NumberFormat(config.lang, { notation: 'compact', maximumFractionDigits: 1 });
        const lo = document.createElement('b'), hi = document.createElement('b');
        lo.textContent = fmt.format(frame.legend.lo);
        // History's scale stops at the 98th percentile; the few above it share its colour
        hi.textContent = `${fmt.format(frame.legend.hi)}+`;
        p.legendEnds.replaceChildren(lo, hi);
      }
      p.tap.hidden = !frame.tap;
      if (frame.tap) {
        p.tap.style.left = `${frame.tap.x}px`;
        p.tap.style.top = `${frame.tap.y}px`;
        p.tap.style.transform = `scale(${0.7 + frame.tap.p * 0.6})`;
        p.tap.style.opacity = String(1 - frame.tap.p * frame.tap.p);
      }
      const showCount = frame.counter && frame.count != null && config.counter;
      p.counter.hidden = !showCount;
      if (showCount) {
        const c = config.counter;
        const fmt = new Intl.NumberFormat(config.lang, { maximumFractionDigits: c.digits ?? 0, useGrouping: c.kind === 'number' });
        p.value.className = c.kind === 'date' ? 'date' : '';
        const y = c.kind === 'date' ? new Date(frame.count).getUTCFullYear() : 0;
        p.value.textContent = c.kind === 'date'
          ? y < 1
            ? `${new Intl.DateTimeFormat(config.lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(frame.count)} ${1 - y} ${c.bce}`
            : new Intl.DateTimeFormat(config.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(frame.count)
          : c.kind === 'year' && frame.count < 1 ? `${fmt.format(1 - frame.count)} ${c.bce}` : fmt.format(frame.count);
        const [head = '', tail = ''] = config.counter.unit.split('{n}').map(s => s.trim());
        p.before.textContent = head;
        p.before.hidden = !head;
        p.unit.textContent = tail;
        p.unit.hidden = !tail;
      }
      p.title.hidden = !frame.title;
      if (frame.title) {
        p.title.textContent = frame.title;
        p.title.style.opacity = frame.titleIn;
        p.title.style.transform = `translateY(${(1 - frame.titleIn) * 10}px)`;
      }
      p.caption.hidden = !frame.caption;
      if (frame.caption) {
        const key = frame.caption.map(w => w.text + w.state).join('|');
        if (key !== lastCaption) {
          lastCaption = key;
          p.words.replaceChildren(...frame.caption.flatMap((w, i) => {
            const s = document.createElement('span');
            s.className = `w${w.state}`;
            s.textContent = w.text;
            return i && !config.unspaced ? [document.createTextNode(' '), s] : [s];
          }));
        }
      }
    },
  };
})();
