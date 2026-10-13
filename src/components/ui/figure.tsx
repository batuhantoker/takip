/** Text with only its numbers in mono, as the README sets them: "3 min", "13 Oct", "3,628 km²". */
export function Figure({ children, className }: { children: string; className?: string }) {
  const parts = children.split(/(\d[\d.,:]*)/);
  return (
    <span className={className ? `whitespace-nowrap ${className}` : 'whitespace-nowrap'}>
      {parts.map((p, i) => (i % 2 ? <span key={i} className="font-mono tabular-nums">{p}</span> : p))}
    </span>
  );
}
