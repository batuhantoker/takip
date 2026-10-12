type Props = NonNullable<GeoJSON.GeoJsonProperties>;

const STYLE = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;`;

export function gnssPopupHtml(p: Props): string {
  const pct = Math.round(Number(p.ratio) * 100);
  return `<div style="${STYLE}border:1px solid #FF6D0040;max-width:280px;">
        <div style="color:#FF6D00;font-size:12px;font-weight:700;margin-bottom:6px;">LIKELY GNSS INTERFERENCE</div>
        <div style="font-size:11px;color:#E8E6E0;">${pct}% of aircraft report degraded position accuracy</div>
        <div style="font-size:9px;color:#aaa;margin-top:2px;">${Number(p.bad)} of ${Number(p.total)} airborne aircraft (NACp ≤ 4) in this 2° cell, latest poll</div>
        <div style="font-size:8px;color:#5C5A54;margin-top:8px;">Inferred from ADS-B, as gpsjam.org does. Avionics faults look the same; it can't tell jamming from spoofing or locate the source.</div>
      </div>`;
}
