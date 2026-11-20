// Кинетический заголовок (ресерч 20.11, M2): каждая буква проявляется из размытия, как чернила в бумаге.
// Буквы одного слова обёрнуты в неразрывный блок: иначе браузер мог перенести «ь» из «день» на новую строку.
export function KineticTitle({ lines, className = '' }: { lines: string[]; className?: string }) {
  let i = 0;
  return (
    <h1 className={className} aria-label={lines.join(' ')}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden>
          {line.split(' ').map((word, wi, words) => (
            <span key={wi}>
              <span className="inline-block whitespace-nowrap">
                {[...word].map((ch, ci) => (
                  <span key={ci} className="ink-letter" style={{ '--i': i++ } as React.CSSProperties}>{ch}</span>
                ))}
              </span>
              {wi < words.length - 1 ? ' ' : null}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
