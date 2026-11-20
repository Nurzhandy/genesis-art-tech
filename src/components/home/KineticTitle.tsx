// Кинетический заголовок (ресерч 20.11, M2): каждая буква проявляется из размытия, как чернила в бумаге.
export function KineticTitle({ lines, className = '' }: { lines: string[]; className?: string }) {
  let i = 0;
  return (
    <h1 className={className} aria-label={lines.join(' ')}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden>
          {[...line].map((ch, ci) => (
            <span key={ci} className="ink-letter" style={{ '--i': i++ } as React.CSSProperties}>{ch === ' ' ? ' ' : ch}</span>
          ))}
        </span>
      ))}
    </h1>
  );
}
