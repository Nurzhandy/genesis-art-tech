'use client';
// Живой фон первого экрана: цветные «облака» из палитр настоящих дней дневника.
// Каждые несколько секунд небо перетекает в цвета следующего дня — осень, ночь в офисе, дождь, лето…
import { useEffect, useMemo, useState } from 'react';
import { demoDays } from './demoDays';

export function HeroAurora({ children }: { children: React.ReactNode }) {
  const days = useMemo(() => demoDays(), []);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % days.length), 5200);
    return () => clearInterval(t);
  }, [days.length]);

  return (
    <div className="hero-aurora relative isolate overflow-hidden">
      {days.map((d, k) => {
        const [a, b, c] = [d.style.palette.accents[0], d.style.palette.accents[1] ?? d.style.palette.accents[0], d.style.palette.accents[2] ?? d.style.palette.bg];
        return (
          <div key={d.name} aria-hidden className="absolute inset-0 -z-10 transition-opacity duration-[2400ms] ease-in-out" style={{ opacity: k === i ? 1 : 0 }}>
            <span className="aurora-cloud" style={{ background: a, left: '-8%', top: '-18%', animationDelay: '0s' }} />
            <span className="aurora-cloud" style={{ background: b, right: '-10%', top: '8%', animationDelay: '-6s' }} />
            <span className="aurora-cloud" style={{ background: c, left: '30%', bottom: '-30%', animationDelay: '-12s' }} />
          </div>
        );
      })}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background" />
      {children}
      <p className="pointer-events-none absolute bottom-4 right-4 font-hand text-xl text-foreground/60 transition-opacity" aria-live="off">
        цвета дня: {days[i]?.title}
      </p>
    </div>
  );
}
