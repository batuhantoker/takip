import { encode } from 'uqr';

/** Black on white with a quiet zone, which authenticator apps need to read it. */
export default function QrCode({ text, size = 168 }: { text: string; size?: number }) {
  const { data } = encode(text, { border: 2 });
  const n = data.length;
  const modules = data.flatMap((row, y) => row.map((on, x) => (on ? `M${x},${y}h1v1h-1z` : ''))).join('');
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="QR code for your authenticator app">
      <rect width={n} height={n} fill="#fff" />
      <path d={modules} fill="#000" />
    </svg>
  );
}
