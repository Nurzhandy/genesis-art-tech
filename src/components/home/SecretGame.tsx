'use client';
// Спрятанная мини-игра (по мотивам Reflect): «Поймай воспоминания». Наберите на главной слово «память»
// (или «memory»), или нажмите едва заметную ✦ внизу первого экрана. Ловите цветные полароиды банкой,
// серые тучи — уворачивайтесь. 30 секунд. Лучший счёт запоминается на устройстве.
import { useEffect, useMemo, useRef, useState } from 'react';
import { demoDays } from './demoDays';

const SECRET = ['память', 'memory'];
const ROUND = 30;
const BEST = 'atmosphere-game-best';

interface Item { x: number; y: number; v: number; good: boolean; color: string; spin: number; size: number }

export function SecretGame() {
  const [open, setOpen] = useState(false);
  const typed = useRef('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key.length !== 1) return;
      typed.current = (typed.current + e.key.toLowerCase()).slice(-10);
      if (SECRET.some((w) => typed.current.endsWith(w))) setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Секрет"
        className="absolute bottom-3 left-3 z-10 h-6 w-6 text-xs text-foreground/15 transition hover:scale-150 hover:text-foreground/70">✦</button>
      {open && <Game onClose={() => setOpen(false)} />}
    </>
  );
}

function Game({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colors = useMemo(() => demoDays().flatMap((d) => d.style.palette.accents.slice(0, 2)), []);
  const [result, setResult] = useState<{ score: number; best: number } | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    setResult(null);
    const g = cv.getContext('2d')!;
    const fit = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; };
    fit();
    window.addEventListener('resize', fit);
    let jar = cv.width / 2, score = 0, shake = 0, last = performance.now(), spawn = 0, raf = 0;
    const started = last;
    const items: Item[] = [];
    const keys = new Set<string>();
    const pop: { x: number; y: number; t: number; text: string }[] = [];
    const move = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); jar = e.clientX - b.left; };
    const kd = (e: KeyboardEvent) => keys.add(e.key);
    const ku = (e: KeyboardEvent) => keys.delete(e.key);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerdown', move);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - started) / 1000;
      const W = cv.width, H = cv.height;
      if (keys.has('ArrowLeft')) jar -= 700 * dt;
      if (keys.has('ArrowRight')) jar += 700 * dt;
      jar = Math.max(50, Math.min(W - 50, jar));
      spawn -= dt;
      if (spawn <= 0) {
        const good = Math.random() > 0.28;
        items.push({ x: 30 + Math.random() * (W - 60), y: -40, v: 140 + t * 9 + Math.random() * 90, good, color: colors[Math.floor(Math.random() * colors.length)] ?? '#e0a030', spin: (Math.random() - 0.5) * 2, size: 30 + Math.random() * 16 });
        spawn = Math.max(0.22, 0.7 - t * 0.015);
      }
      g.save();
      if (shake > 0) { g.translate((Math.random() - 0.5) * 12 * shake, 0); shake -= dt * 3; }
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1b1730'); sky.addColorStop(1, '#3d2b4f');
      g.fillStyle = sky; g.fillRect(-20, 0, W + 40, H);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.v * dt;
        g.save(); g.translate(it.x, it.y); g.rotate(it.spin * t * 0.6);
        if (it.good) {
          g.fillStyle = '#fbf8f2'; g.fillRect(-it.size / 2, -it.size / 2, it.size, it.size * 1.18);
          g.fillStyle = it.color; g.fillRect(-it.size / 2 + 4, -it.size / 2 + 4, it.size - 8, it.size - 8);
        } else {
          g.fillStyle = '#8a8f98';
          for (const [dx, r] of [[-10, 14], [4, 18], [16, 12]] as const) { g.beginPath(); g.arc(dx, 0, r, 0, Math.PI * 2); g.fill(); }
        }
        g.restore();
        const caught = it.y > H - 110 && it.y < H - 40 && Math.abs(it.x - jar) < 58;
        if (caught) {
          score += it.good ? 1 : -2;
          if (!it.good) shake = 1;
          pop.push({ x: it.x, y: H - 120, t: 0, text: it.good ? '+1' : '−2' });
          items.splice(i, 1);
        } else if (it.y > H + 40) items.splice(i, 1);
      }
      // Банка воспоминаний
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3;
      g.beginPath(); g.roundRect(jar - 55, H - 100, 110, 80, 18); g.fill(); g.stroke();
      g.fillStyle = '#e0a030'; g.fillRect(jar - 40, H - 112, 80, 12);
      for (const p of pop) { p.t += dt; g.globalAlpha = Math.max(0, 1 - p.t); g.fillStyle = '#fff'; g.font = '600 28px serif'; g.fillText(p.text, p.x, p.y - p.t * 60); }
      g.globalAlpha = 1;
      g.fillStyle = '#fff'; g.font = '600 32px serif'; g.textAlign = 'left';
      g.fillText(`Воспоминаний: ${score}`, 24, 48);
      g.textAlign = 'right'; g.fillText(`${Math.max(0, Math.ceil(ROUND - t))} с`, W - 24, 48);
      g.restore();
      if (t >= ROUND) {
        let best = score;
        try { best = Math.max(score, Number(localStorage.getItem(BEST) ?? 0)); localStorage.setItem(BEST, String(best)); } catch { /* без рекорда */ }
        setResult({ score, best });
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerdown', move);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, [run, colors]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Мини-игра «Поймай воспоминания»" className="fixed inset-0 z-[100] bg-black">
      <canvas ref={ref} className="h-full w-full touch-none" />
      <button type="button" onClick={onClose} className="absolute right-4 top-16 rounded-full bg-white/15 px-4 py-1.5 text-white hover:bg-white/25">Закрыть · Esc</button>
      {!result && <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center font-hand text-2xl text-white/70">ловите полароиды банкой, от туч уворачивайтесь — мышью или стрелками</p>}
      {result && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 text-center text-white">
          <p className="font-hand text-4xl">Вы поймали {result.score} {result.score === 1 ? 'воспоминание' : 'воспоминаний'}</p>
          <p className="text-lg text-white/70">Лучший результат: {result.best}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setRun((r) => r + 1)} className="rounded-full bg-white px-6 py-2.5 text-lg text-black">Ещё раз</button>
            <button type="button" onClick={onClose} className="rounded-full border border-white/40 px-6 py-2.5 text-lg">Вернуться в дневник</button>
          </div>
        </div>
      )}
    </div>
  );
}
