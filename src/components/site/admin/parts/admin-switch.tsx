/** An on/off console setting. `warnOff` draws the off state in red, for switches whose off state loses something. */
export function Switch({ on, states, disabled, label, onClick, warnOff = true }: {
  on: boolean;
  states: [on: string, off: string];
  disabled: boolean;
  label: string;
  onClick: () => void;
  warnOff?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 h-8 whitespace-nowrap disabled:opacity-40"
    >
      <span className={`relative inline-block w-8 h-[18px] rounded-full border transition-colors ${on ? 'border-accent bg-accent' : 'border-line-strong bg-surface-3'}`}>
        <span className={`absolute top-[2px] size-3 rounded-full transition-[left] ${on ? 'left-[16px] bg-on-accent' : 'left-[2px] bg-ink-3'}`} />
      </span>
      <span className={`text-[12px] ${on ? 'text-ink-1' : warnOff ? 'text-red' : 'text-ink-2'}`}>{on ? states[0] : states[1]}</span>
    </button>
  );
}
