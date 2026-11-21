'use client';
// Вход на сайт (21.11): «Какого цвета был твой вчерашний день?»
// Вопрос пишется от руки в темноте, буквы рассыпаются в тысячи частиц, частицы вихрем собираются
// в настоящий постер дня (тот же движок, что рисует дни), постер оживает — «Теперь — видно».
// Это и есть суть кейса: невидимое (слова, настроение) становится видимым (страница дня).
// Один раз на браузер; пропустить — клик или любая клавиша; при «уменьшить движение» не показываем.
// ?intro=1 в адресе — показать ещё раз (для демо и видео).
import { useEffect, useRef, useState } from 'react';
import { demoDays } from '@/components/home/demoDays';

/** Когда закончится заставка (performance.now) — стол ждёт её, прежде чем «ронять» дневники. */
export let introEndsAt = 0;
let decided: boolean | null = null;

const SEEN = 'intro-color-seen';
const LINES = ['Какого цвета был', 'твой вчерашний день?'];
const ANSWER = 'Теперь — видно.';
const INK = [239, 226, 207];   // кремовые «чернила» вопроса

// Таймлайн, мс от старта
const T = { write: 250, writeEnd: 2000, burst: 2350, swirlEnd: 3250, landEnd: 5000, reveal: 5350, answer: 5500, exit: 6500, done: 7200 };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

interface P { sx: number; sy: number; a0: number; r0: number; spin: number; grow: number; tx: number; ty: number; col: string; delay: number }

export function EntryIntro() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Решение принимаем один раз на загрузку: React в разработке запускает эффект дважды.
    if (decided === null) {
      let seen = false;
      const force = new URLSearchParams(window.location.search).has('intro');
      try { seen = localStorage.getItem(SEEN) === '1'; localStorage.setItem(SEEN, '1'); } catch { /* приватный режим */ }
      decided = (force || !seen) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    if (!decided) return;
    introEndsAt = performance.now() + T.done;
    const t = setTimeout(() => setShow(true), 0);
    return () => clearTimeout(t);
  }, []);
  return show ? <ColorIntro onDone={() => { introEndsAt = performance.now(); setShow(false); }} /> : null;
}

function ColorIntro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveBox = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'play' | 'answer' | 'exit'>('play');
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    let alive = true;
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t0 = performance.now();
    let exitAt = T.exit;

    // Постер: autumn-park — тот самый осенний парк с какао; рисует настоящий движок дня.
    const ph = Math.min(H * 0.78, (W - 32) * (16 / 9));
    const pw = ph * (9 / 16);
    const px = (W - pw) / 2, py = (H - ph) / 2 - H * 0.03;
    let engine: { canvas: HTMLCanvasElement; renderAt(t: number): void; play(t?: number): void; destroy(): void } | null = null;
    let targets: { x: number; y: number; col: string }[] | null = null;
    const step = W < 500 ? 5 : 4;
    (async () => {
      try {
        const day = demoDays().find((d) => d.name === 'autumn-park') ?? demoDays()[0];
        const { createEngine } = await import('@/render/engine');
        const off = document.createElement('canvas');
        // Маски людей (модель TensorFlow) заставке не нужны — без них постер готов за доли секунды.
        const v = day.style.visual;
        const style = v ? { ...day.style, visual: { ...v, portrait: { ...v.portrait, focusPeople: false } } } : day.style;
        const e = await createEngine(off, { style, photoUrls: day.photos, info: { title: day.title, caption: day.caption, date: day.date, songLabel: day.song, notes: day.notes } });
        if (!alive) { e.destroy(); return; }
        e.renderAt(12);   // страница собрана: фото, марки, подпись
        const s = document.createElement('canvas');
        const cw = Math.round(pw / step), ch = Math.round(ph / step);
        s.width = cw; s.height = ch;
        const sg = s.getContext('2d', { willReadFrequently: true })!;
        sg.drawImage(off, 0, 0, cw, ch);
        const data = sg.getImageData(0, 0, cw, ch).data;
        const list: { x: number; y: number; col: string }[] = [];
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          list.push({ x: px + x * step, y: py + y * step, col: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})` });
        }
        targets = list;
        engine = e;
      } catch { /* без постера — частицы просто растворятся */ }
    })();

    // Вопрос: рисуем на этом же холсте, чтобы частицы стартовали ровно из букв.
    const probe = document.createElement('span');
    probe.className = 'font-hand';
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily || 'cursive';
    probe.remove();
    const size = Math.max(34, Math.min(84, W / 11));
    const font = `500 ${size}px ${family}`;
    const lineY = (i: number) => H / 2 - size * 0.55 + i * size * 1.15;
    let particles: P[] | null = null;

    function drawQuestion(reveal: number) {
      g.save();
      g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = `rgb(${INK.join(',')})`;
      LINES.forEach((line, i) => {
        const k = clamp(reveal * LINES.length - i);   // строки пишутся по очереди
        if (k <= 0) return;
        const w = g.measureText(line).width;
        g.save();
        g.beginPath(); g.rect(W / 2 - w / 2 - 10, lineY(i) - size, (w + 20) * k, size * 2); g.clip();
        g.fillText(line, W / 2, lineY(i));
        g.restore();
      });
      g.restore();
    }

    function burst() {
      // Пиксели букв — стартовые точки частиц.
      const img = g.getImageData(0, 0, canvas.width, canvas.height).data;
      const pts: number[] = [];
      const stride = Math.max(2, Math.round(2 * dpr));
      for (let y = 0; y < canvas.height; y += stride) for (let x = 0; x < canvas.width; x += stride) {
        if (img[(y * canvas.width + x) * 4 + 3] > 120) pts.push(x / dpr, y / dpr);
      }
      const tg = targets ?? Array.from({ length: 6000 }, () => ({ x: W / 2 + (Math.random() - 0.5) * W, y: H / 2 + (Math.random() - 0.5) * H, col: 'rgba(0,0,0,0)' }));
      const n = pts.length / 2 || 1;
      particles = tg.map((t) => {
        const j = Math.floor(Math.random() * n) * 2;
        const sx = pts[j] ?? W / 2, sy = pts[j + 1] ?? H / 2;
        const dx = sx - W / 2, dy = sy - H / 2;
        return {
          sx, sy, tx: t.x, ty: t.y, col: t.col,
          a0: Math.atan2(dy, dx), r0: Math.hypot(dx, dy),
          spin: (0.9 + Math.random() * 1.6) * (Math.random() < 0.85 ? 1 : -1),
          grow: 40 + Math.random() * Math.min(W, H) * 0.45,
          delay: Math.random() * 0.35 + (Math.hypot(t.x - W / 2, t.y - H / 2) / Math.max(W, H)) * 0.3,
        };
      });
    }

    const frame = () => {
      if (!alive) return;
      const t = performance.now() - t0;
      g.clearRect(0, 0, W, H);

      if (t < T.burst) {
        drawQuestion(clamp((t - T.write) / (T.writeEnd - T.write)));
      } else {
        if (!particles) {
          // Движок ещё рисует постер — держим вопрос, пока не будут готовы цвета (не дольше 2,5 с).
          if (!targets && t < T.burst + 2500) { drawQuestion(1); raf = requestAnimationFrame(frame); return; }
          drawQuestion(1);
          burst();
          shift = t - T.burst;
        }
        drawParticles(t - shift);
      }
      if (t - shift > exitAt + 700) { finish(); return; }
      raf = requestAnimationFrame(frame);
    };

    let shift = 0;
    let revealed = false;
    function drawParticles(t: number) {
      const ps = particles!;
      const swirl = clamp((t - T.burst) / (T.swirlEnd - T.burst));
      const sz = step * 0.62;
      const big = step + 0.6;
      // Кремовые частицы — одним проходом; окрашенные — каждая своим цветом.
      g.fillStyle = `rgb(${INK.join(',')})`;
      g.beginPath();
      const colored: [number, number, number, string][] = [];
      for (const p of ps) {
        // Вихрь: частица уходит от центра и закручивается вокруг него.
        const sEase = easeOut(swirl);
        const a = p.a0 + p.spin * sEase * 1.6;
        const r = p.r0 + p.grow * sEase;
        const vx = W / 2 + Math.cos(a) * r, vy = H / 2 + Math.sin(a) * r;
        const land = clamp((t - T.swirlEnd) / (T.landEnd - T.swirlEnd) / (1 - p.delay * 0.6) - p.delay * 0.4);
        if (land <= 0) { g.rect(vx, vy, sz, sz); continue; }
        // Посадка по дуге: угол докручивается, радиус сходится к своей точке постера.
        const k = ease(land);
        const bend = Math.sin(k * Math.PI) * 0.35 * p.spin;
        const x = vx + (p.tx - vx) * k + Math.cos(a + Math.PI / 2) * 40 * bend;
        const y = vy + (p.ty - vy) * k + Math.sin(a + Math.PI / 2) * 40 * bend;
        const s = sz + (big - sz) * k;
        if (k < 0.1) g.rect(x, y, s, s);
        else colored.push([x, y, s, p.col]);
      }
      g.fill();
      for (const [x, y, s, c] of colored) { g.fillStyle = c; g.fillRect(x, y, s, s); }

      // Мозаика сложилась — подменяем её живым постером (листья начинают падать).
      if (!revealed && t > T.reveal && engine && liveBox.current) {
        revealed = true;
        const c = engine.canvas;
        c.style.width = `${pw}px`; c.style.height = `${ph}px`; c.style.display = 'block';
        liveBox.current.appendChild(c);
        engine.play(12);
        requestAnimationFrame(() => { if (liveBox.current) liveBox.current.style.opacity = '1'; });
        timers.push(setTimeout(() => alive && setPhase('answer'), T.answer - T.reveal));
      }
      if (!engine && t > T.landEnd) exitAt = Math.min(exitAt, t);
      if (t > exitAt) setPhase('exit');
    }

    function finish() {
      alive = false;
      cancelAnimationFrame(raf);
      engine?.destroy();
      doneRef.current();
    }

    // Пропустить: клик, касание или любая клавиша.
    const skip = () => { setPhase('exit'); timers.push(setTimeout(finish, 600)); };
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    document.documentElement.style.overflow = 'hidden';

    const start = () => { raf = requestAnimationFrame(frame); };
    if (document.fonts?.load) document.fonts.load(font).then(start, start); else start();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      engine?.destroy();
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div role="presentation" aria-hidden className="fixed inset-0 z-[80] cursor-pointer select-none overflow-hidden bg-[#0d0a08]"
      style={{ opacity: phase === 'exit' ? 0 : 1, transform: phase === 'exit' ? 'scale(1.04)' : 'none', transition: 'opacity 0.7s ease, transform 0.9s cubic-bezier(0.4,0,0.2,1)' }}>
      {/* Тёплый отсвет, как от лампы над столом */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(55% 45% at 50% 45%, rgba(200,120,60,0.16), transparent 70%)' }} />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div ref={liveBox} className="absolute left-1/2 top-1/2 shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
        style={{ opacity: 0, transition: 'opacity 0.45s ease', marginTop: '-3vh', transform: 'translate(-50%, -50%)' }} />
      <p className="pointer-events-none absolute inset-x-0 bottom-[5vh] text-center font-hand text-4xl text-[#efe2cf] sm:text-5xl"
        style={{ opacity: phase === 'answer' ? 1 : 0, transform: phase === 'answer' ? 'none' : 'translateY(10px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
        {ANSWER}
      </p>
      <p className="pointer-events-none absolute bottom-4 right-5 text-sm text-[#efe2cf]/40">нажмите, чтобы пропустить</p>
    </div>
  );
}
