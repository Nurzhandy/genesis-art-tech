'use client';
// B11 V10: запотевшее стекло поверх дня (дождь, туман, снег, мороз). Проведите пальцем — стекло протирается,
// след за ~6 с запотевает обратно. Капли дождя — маленькие линзы: в каждой перевёрнутый увеличенный кусочек кадра.
import { useEffect, useRef, useState } from 'react';
import { mulberry32 } from '@/render/rng';

const REFOG_SEC = 6;

export function FogGlass({ source, seed, rain }: { source: HTMLCanvasElement | null; seed: number; rain: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !source) return;
    const g = cv.getContext('2d')!;
    // Стекло считаем в половинном разрешении: туман всё равно размытый, а телефон держит 30+ fps.
    const W = Math.max(1, Math.round(cv.clientWidth / 2)), H = Math.max(1, Math.round(cv.clientHeight / 2));
    cv.width = W; cv.height = H;
    const wipe = document.createElement('canvas');
    wipe.width = W; wipe.height = H;
    const wg = wipe.getContext('2d')!;
    const fog = document.createElement('canvas');
    fog.width = W; fog.height = H;
    const fg = fog.getContext('2d')!;
    const rand = mulberry32(seed * 101 + 7);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Стекло уже чуть протёрто — по seed, как будто кто-то провёл рукой.
    wg.lineCap = 'round';
    wg.strokeStyle = 'rgba(0,0,0,0.9)';
    wg.lineWidth = W * 0.16;
    wg.beginPath();
    wg.moveTo(W * (0.2 + rand() * 0.2), H * (0.3 + rand() * 0.2));
    wg.quadraticCurveTo(W * 0.5, H * (0.2 + rand() * 0.3), W * (0.65 + rand() * 0.2), H * (0.4 + rand() * 0.2));
    wg.stroke();

    const drops = rain ? Array.from({ length: 34 }, () => ({ x: rand() * W, y: rand() * H, r: 3 + rand() * 7, v: 2 + rand() * 10 })) : [];
    let raf = 0, last = performance.now();

    const frame = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // Запотевание: след стирания тает за REFOG_SEC.
      wg.save();
      wg.globalCompositeOperation = 'destination-out';
      wg.fillStyle = `rgba(0,0,0,${dt / REFOG_SEC})`;
      wg.fillRect(0, 0, W, H);
      wg.restore();
      // Туман: размытый кадр + молочная дымка, минус протёртые места.
      fg.clearRect(0, 0, W, H);
      fg.filter = 'blur(9px) brightness(1.06)';
      fg.drawImage(source, 0, 0, W, H);
      fg.filter = 'none';
      fg.fillStyle = 'rgba(235,240,245,0.32)';
      fg.fillRect(0, 0, W, H);
      fg.globalCompositeOperation = 'destination-out';
      fg.drawImage(wipe, 0, 0);
      fg.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.drawImage(fog, 0, 0);
      // Капли-линзы: перевёрнутый увеличенный кусок кадра под каплей.
      const sx = source.width / W, sy = source.height / H;
      for (const d of drops) {
        if (!reduced) { d.y += d.v * dt * (d.r / 6); if (d.y > H + 10) { d.y = -10; d.x = rand() * W; } }
        g.save();
        g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.clip();
        g.translate(d.x, d.y); g.scale(1, -1);
        const span = d.r * 3.2;
        g.drawImage(source, (d.x - span) * sx, (d.y - span) * sy, span * 2 * sx, span * 2 * sy, -d.r, -d.r, d.r * 2, d.r * 2);
        g.restore();
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.beginPath(); g.arc(d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.25, 0, Math.PI * 2); g.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    frame();

    const brush = (e: PointerEvent) => {
      // Мышью протираем и без нажатия — так естественнее на ноутбуке.
      const b = cv.getBoundingClientRect();
      const x = ((e.clientX - b.left) / b.width) * W, y = ((e.clientY - b.top) / b.height) * H;
      const r = W * 0.09;
      const gr = wg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.9)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      wg.fillStyle = gr;
      wg.fillRect(x - r, y - r, r * 2, r * 2);
      setTouched(true);
    };
    cv.addEventListener('pointermove', brush);
    cv.addEventListener('pointerdown', brush);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointermove', brush); cv.removeEventListener('pointerdown', brush); };
  }, [source, seed, rain]);

  return (
    <>
      <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full touch-none rounded-sm" />
      {!touched && (
        <p className="pointer-events-none absolute inset-x-0 bottom-1/3 text-center font-hand text-2xl text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
          проведите по стеклу
        </p>
      )}
    </>
  );
}
