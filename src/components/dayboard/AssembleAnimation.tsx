'use client';
// Вау-момент «Собрать день» (план 21.11, человек 3): всё, что лежало на доске, слетается в центр и
// впитывается в постер. Фото ложатся в рамку, заметки становятся строками текста, пластинка крутится,
// капля-настроение окрашивает лист. Анимация идёт, пока сервер собирает день; done=true завершает её.
import { useEffect, useMemo, useState } from 'react';
import { assemblyPicks, boardBox, fitInto, itemBox, type AnyItem } from '@/lib/dayboard/layout';
import { ItemFace, moodColors } from './ItemFace';

const STEPS = ['Читаю заметки…', 'Смотрю на фото…', 'Слушаю песню…', 'Подбираю палитру…', 'Пишу название…', 'Складываю страницу…'];

interface Token { it: AnyItem; w: number; h: number; from: string; to: string; delay: number; fade: boolean; spin: boolean }

export function AssembleAnimation({ items, urls, done, onDone }: { items: AnyItem[]; urls: Record<string, string>; done: boolean; onDone: () => void }) {
  const [base, setStage] = useState(0);
  const stage = done && base >= 2 ? 3 : base; // 3 — финал: лист приближается, всё растворяется
  const [step, setStep] = useState(0);
  const [vp] = useState(() => ({ W: window.innerWidth, H: window.innerHeight }));
  const reduce = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);

  const { tokens, poster, lines, tint } = useMemo(() => plan(items, vp.W, vp.H), [items, vp]);

  useEffect(() => {
    // Первый кадр рисуется в позициях доски, потом элементы летят. setTimeout — запасной путь, если rAF стоит (фоновая вкладка).
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setStage((s) => Math.max(s, 1))));
    const t1 = setTimeout(() => setStage((s) => Math.max(s, 1)), 80);
    const t = setTimeout(() => setStage((s) => Math.max(s, 2)), reduce ? 50 : 1800);
    const steps = setInterval(() => setStep((v) => Math.min(STEPS.length - 1, v + 1)), 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t); clearInterval(steps); };
  }, [reduce]);

  useEffect(() => {
    if (stage !== 3) return;
    const t = setTimeout(onDone, reduce ? 0 : 750);
    return () => clearTimeout(t);
  }, [stage, onDone, reduce]);

  const dur = reduce ? 0 : 1000;
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-background/90 backdrop-blur-sm" role="status" aria-live="polite"
      style={{ opacity: stage === 3 ? 0 : 1, transition: `opacity ${reduce ? 0 : 700}ms ease ${reduce ? 0 : 150}ms` }}>
      <style>{'@keyframes db-spin{to{transform:rotate(360deg)}}.db-spin [data-vinyl]{animation:db-spin 2.4s linear infinite}'}</style>
      {/* Лист будущей страницы */}
      <div className="absolute overflow-hidden rounded-sm shadow-2xl ring-1 ring-black/10"
        style={{
          left: poster.x, top: poster.y, width: poster.w, height: poster.h,
          background: tint.length > 1 ? `linear-gradient(160deg, ${tint.join(', ')})` : tint[0],
          opacity: stage === 0 ? 0 : 1,
          transform: stage === 3 ? 'scale(1.35)' : stage === 0 ? 'scale(.92)' : 'scale(1)',
          transition: `opacity ${dur * 0.6}ms ease, transform ${reduce ? 0 : 750}ms cubic-bezier(.2,.8,.2,1)`,
          boxShadow: stage >= 2 ? `0 0 80px ${tint[0]}88` : undefined,
        }}>
        <div className="absolute inset-0 bg-[#fbf8f2]" style={{ opacity: stage >= 2 ? 0.55 : 1, transition: `opacity ${dur}ms ease` }} />
        <div className="absolute inset-x-[10%] bottom-[16%] flex flex-col gap-1.5">
          {lines.map((l, i) => (
            <p key={i} className="truncate font-hand text-xl leading-tight text-[#2b241c]"
              style={{ opacity: stage >= 2 ? 1 : 0, transform: stage >= 2 ? 'none' : 'translateY(8px)', transition: `all 500ms ease ${reduce ? 0 : i * 160}ms` }}>{l}</p>
          ))}
        </div>
      </div>
      {tokens.map((t) => (
        <div key={t.it.id} className={`absolute left-0 top-0 ${t.spin && stage >= 2 ? 'db-spin' : ''}`}
          style={{
            width: t.w, minHeight: t.h, transformOrigin: 'center',
            transform: stage === 0 ? t.from : t.to,
            opacity: t.fade && stage >= 2 ? 0 : 1,
            transition: `transform ${dur}ms cubic-bezier(.65,0,.25,1) ${reduce ? 0 : t.delay}ms, opacity 500ms ease`,
          }}>
          <ItemFace it={t.it} urls={urls} />
        </div>
      ))}
      <p className="absolute inset-x-0 text-center font-hand text-3xl" style={{ top: poster.y + poster.h + 18 }}>{stage === 3 ? 'Готово' : STEPS[step]}</p>
    </div>
  );
}

/** Откуда и куда летит каждый элемент. Чистая раскладка по размеру экрана. */
function plan(items: AnyItem[], W: number, H: number) {
  const ph = Math.min(H * 0.68, 620), pw = (ph * 9) / 16;
  const cx = W / 2, cy = H / 2 - 24;
  const poster = { x: cx - pw / 2, y: cy - ph / 2, w: pw, h: ph };
  const box = boardBox(items);
  const fit = box ? fitInto(box, W, H, 60) : { s: 1, dx: 0, dy: 0 };
  const picks = assemblyPicks(items);
  const photoIdx = new Map(picks.photos.map((p, i) => [p.id, i]));
  const lines = [...picks.notes.map((n) => n.text), ...picks.voices.map((v) => v.transcript ?? '')].flatMap((t) => t.split(/\n+/)).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const moods = items.filter((i) => i.kind === 'mood');
  const tint = moods.length ? moods.flatMap((m) => moodColors((m as { feelings?: unknown }).feelings)).slice(0, 3) : ['#efe7da'];

  // Порядок вылета: сначала то, что «впитывается», потом фото и заметки, пластинка последней.
  const rank = (it: AnyItem) => (it.kind === 'song' ? 3 : it.kind === 'photo' ? 2 : it.kind === 'note' ? 1 : 0);
  const ordered = [...items].filter((i) => i.kind !== 'day').sort((a, b) => rank(a) - rank(b));
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  const tokens: Token[] = ordered.map((it, n) => {
    const b = itemBox(it);
    const w = Math.max(b.w, 1), h = Math.max(b.h, 1);
    const rot = Number((it as { rot?: number }).rot) || 0;
    const sx = fit.dx + (b.x + b.w / 2) * fit.s, sy = fit.dy + (b.y + b.h / 2) * fit.s;
    const from = `translate(${sx - w / 2}px, ${sy - h / 2}px) rotate(${rot}deg) scale(${fit.s})`;
    let tx = cx + (rnd() - 0.5) * pw * 0.6, ty = cy + (rnd() - 0.5) * ph * 0.6, ts = 0.15, tr = 0, fade = true, spin = false;
    if (it.kind === 'photo') {
      const k = photoIdx.get(it.id) ?? 4;
      tx = cx + (k - 2) * 5; ty = cy - ph * 0.17 + k * 5; ts = (pw * 0.8) / w; tr = [-3, 2, -1.5, 3, -2][k] ?? 0; fade = k > 4;
    } else if (it.kind === 'note' || it.kind === 'voice') {
      tx = cx; ty = cy + ph * 0.25; ts = (pw * 0.5) / w; tr = 0;
    } else if (it.kind === 'song' && picks.song?.id === it.id) {
      tx = cx + pw * 0.3; ty = cy + ph * 0.36; ts = (pw * 0.36) / w; tr = 0; fade = false; spin = true;
    }
    const to = `translate(${tx - w / 2}px, ${ty - h / 2}px) rotate(${tr}deg) scale(${ts})`;
    return { it, w, h, from, to, delay: Math.min(n * 70, 700), fade, spin };
  });
  return { tokens, poster, lines, tint };
}
