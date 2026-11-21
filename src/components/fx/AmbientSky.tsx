'use client';
// Живое небо за всеми страницами: мягкие цветные облака из палитр настоящих дней дневника,
// медленно перетекают от дня к дню. На главной, странице дня и подарке его нет: там свой фон.
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { demoDays } from '@/components/home/demoDays';

export function AmbientSky() {
  const path = usePathname();
  const days = useMemo(() => demoDays(), []);
  const [i, setI] = useState(0);
  const off = path === '/' || path.startsWith('/day/') || path.startsWith('/s/');
  useEffect(() => {
    if (off || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % days.length), 9000);
    return () => clearInterval(t);
  }, [off, days.length]);
  if (off) return null;

  return (
    <div aria-hidden className="ambient-sky pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {days.map((d, k) => {
        const [a, b, c] = [d.style.palette.accents[0], d.style.palette.accents[1] ?? d.style.palette.accents[0], d.style.palette.accents[2] ?? d.style.palette.bg];
        return (
          <div key={d.name} className="absolute inset-0 transition-opacity duration-[3000ms] ease-in-out" style={{ opacity: k === i ? 1 : 0 }}>
            <span className="aurora-cloud ambient-cloud" style={{ background: a, left: '-20%', top: '-25%' }} />
            <span className="aurora-cloud ambient-cloud" style={{ background: b, right: '-25%', top: '30%', animationDelay: '-7s' }} />
            <span className="aurora-cloud ambient-cloud" style={{ background: c, left: '10%', bottom: '-35%', animationDelay: '-13s' }} />
          </div>
        );
      })}
      {/* Пылинки света: медленно плывут вверх, как в луче солнца */}
      {Array.from({ length: 18 }, (_, k) => (
        <span key={k} className="ambient-mote" style={{ left: `${(k * 53) % 100}%`, animationDelay: `-${(k * 3.7) % 24}s`, animationDuration: `${18 + (k % 5) * 4}s` }} />
      ))}
    </div>
  );
}
