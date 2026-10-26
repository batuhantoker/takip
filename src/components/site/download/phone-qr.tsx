import { encode } from 'uqr';

/** This page's address as a QR code, for a visitor on a computer whose phone is the one that needs the app. */
export function PhoneQr({ url, label }: { url: string; label: string }) {
  const { data } = encode(url, { border: 2 });
  const n = data.length;
  const modules = data.flatMap((row, y) => row.map((on, x) => (on ? `M${x},${y}h1v1h-1z` : ''))).join('');
  return (
    <figure className="flex max-w-[22rem] items-center gap-4 rounded-card border border-line bg-surface-1 p-4">
      <svg viewBox={`0 0 ${n} ${n}`} width={112} height={112} shapeRendering="crispEdges" role="img" aria-label={label} className="shrink-0 rounded-control">
        <rect width={n} height={n} fill="#fff" />
        <path d={modules} fill="#000" />
      </svg>
      <figcaption className="text-[14px] leading-relaxed text-ink-2">{label}</figcaption>
    </figure>
  );
}
