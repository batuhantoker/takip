/** Mono is for numbers: in "Front-runner 42%" only "42%" is set in Geist Mono. */
const FIGURE = /([−+-]?\d[\d.,:]*(?:%|[kMB](?![a-z]))?)/;

export function Figures({ text, svg = false }: { text: string; svg?: boolean }) {
  return (
    <>
      {text.split(FIGURE).map((part, i) => {
        if (!part) return null;
        if (i % 2 === 0) return part;
        return svg
          ? <tspan key={i} className="font-mono">{part}</tspan>
          : <span key={i} className="font-mono tabular-nums">{part}</span>;
      })}
    </>
  );
}
