// Режим «Рисунок»: страница дня как иллюстрация из книжки. Сцена собирается из правил (style.scene):
// небо по времени суток, погода, место (луг, парк, вода, город, комната, дорога), сезон, люди, птицы, плед.
// Всё детерминировано seed-ом: один день — одна и та же картинка; движение — функция времени.
import type { StyleParams } from '@/lib/types';
import type { SceneParams } from '@/lib/style/scene';
import { rgba } from './draw';
import { mulberry32 } from './rng';
import type { RenderPhoto, Zone } from './types';

const SKY: Record<SceneParams['sky'], [string, string]> = {
  day: ['#6fb8f2', '#d6efff'], golden: ['#f59a5b', '#ffe1a3'], dusk: ['#4b3f7a', '#f2a28a'], night: ['#0a1430', '#2a3970'],
};
const GROUND: Record<SceneParams['season'], [string, string]> = {
  summer: ['#5aa646', '#3f8a35'], spring: ['#8fd16a', '#62b14b'], autumn: ['#d39a3a', '#b5702a'], winter: ['#eef3f8', '#cfdbe6'],
};
const CANOPY: Record<SceneParams['season'], string[]> = {
  summer: ['#3f8f3a', '#4fa544', '#2f7a33'], spring: ['#7cc46a', '#f4b6c8', '#9ad07c'], autumn: ['#e07b2a', '#d9a53a', '#b8462a'], winter: ['#dfe8f0', '#c6d3de'],
};

/** Старые дни без style.scene: сцена из атмосферы и техники. */
export function sceneOf(style: StyleParams): SceneParams {
  if (style.scene) return style.scene;
  const k = style.atmosphere?.kind ?? 'none';
  return {
    sky: k === 'lights' ? 'night' : 'day', setting: k === 'lights' ? 'city' : 'meadow',
    season: k === 'snow' ? 'winter' : k === 'leaves' ? 'autumn' : 'summer',
    weather: k === 'rain' ? 'rain' : k === 'snow' ? 'snow' : k === 'mist' ? 'cloudy' : 'clear',
    people: 0, birds: k === 'none' || k === 'dust', picnic: false, steam: k === 'mist',
  };
}

export function createScene(style: StyleParams, zone: Zone, photos: RenderPhoto[]) {
  const sc = sceneOf(style);
  const rand = mulberry32(style.seed * 7 + 3);
  const { x: X, y: Y, w: Wz, h: Hz } = zone;
  const horizon = Y + Hz * (sc.setting === 'water' ? 0.55 : 0.6);
  const grey = sc.weather === 'rain' || sc.weather === 'cloudy';
  const night = sc.sky === 'night';
  const people = ['#e0574a', '#3d6fd1', '#f2b33d', '#7a4fb8', '#2e9b6a'];
  // Предрасчёт: облака, деревья, звёзды, окна, цветы — один раз.
  const clouds = Array.from({ length: grey ? 7 : 4 }, () => ({ x: rand(), y: 0.05 + rand() * 0.25, s: 0.6 + rand() * 0.7, v: 0.004 + rand() * 0.008 }));
  const stars = night ? Array.from({ length: 70 }, () => ({ x: rand(), y: rand() * 0.55, r: 0.6 + rand() * 1.8, p: rand() * 6 })) : [];
  const trees = Array.from({ length: sc.setting === 'park' ? 7 : 3 }, (_, i) => ({ x: (i + 0.3 + rand() * 0.5) / (sc.setting === 'park' ? 7 : 3), s: 0.7 + rand() * 0.6, pine: sc.season === 'winter' || rand() > 0.8, c: CANOPY[sc.season][Math.floor(rand() * CANOPY[sc.season].length)] }));
  const flowers = sc.season === 'summer' || sc.season === 'spring' ? Array.from({ length: 40 }, () => ({ x: rand(), y: rand(), c: ['#ffffff', '#ffd23f', '#ff6f91', '#c77dff'][Math.floor(rand() * 4)] })) : [];
  const buildings = Array.from({ length: 9 }, (_, i) => ({ x: i / 9, w: 0.09 + rand() * 0.03, h: 0.18 + rand() * 0.32, lit: Array.from({ length: 24 }, () => rand() > (night ? 0.45 : 0.85)) }));
  const birds = sc.birds ? Array.from({ length: 5 }, () => ({ y: 0.12 + rand() * 0.2, v: 0.03 + rand() * 0.03, o: rand(), s: 0.7 + rand() * 0.6 })) : [];

  function sky(g: CanvasRenderingContext2D) {
    const [top, bottom] = SKY[sc.sky];
    const gr = g.createLinearGradient(0, Y, 0, horizon);
    gr.addColorStop(0, grey && !night ? '#7d8a99' : top);
    gr.addColorStop(1, grey && !night ? '#c9d1d9' : bottom);
    g.fillStyle = gr;
    g.fillRect(X, Y, Wz, horizon - Y + 2);
  }

  function sunMoon(g: CanvasRenderingContext2D, t: number) {
    const sx = X + Wz * 0.78, sy = Y + Hz * (sc.sky === 'golden' || sc.sky === 'dusk' ? 0.42 : 0.16);
    if (night) {
      for (const s of stars) { g.fillStyle = `rgba(255,255,240,${0.5 + 0.5 * Math.sin(t * 2 + s.p)})`; g.beginPath(); g.arc(X + s.x * Wz, Y + s.y * (horizon - Y), s.r, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#fdf6d8'; g.beginPath(); g.arc(sx, sy, Wz * 0.06, 0, Math.PI * 2); g.fill();
      g.fillStyle = SKY.night[0]; g.beginPath(); g.arc(sx + Wz * 0.025, sy - Wz * 0.015, Wz * 0.055, 0, Math.PI * 2); g.fill();
      return;
    }
    if (grey) return;
    const r = Wz * 0.075;
    const glow = g.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 3.2);
    glow.addColorStop(0, 'rgba(255,240,180,0.85)'); glow.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = glow; g.fillRect(sx - r * 3.2, sy - r * 3.2, r * 6.4, r * 6.4);
    g.save(); g.translate(sx, sy); g.rotate(t * 0.15);
    g.strokeStyle = 'rgba(255,220,120,0.9)'; g.lineWidth = 5; g.lineCap = 'round';
    for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(r * 1.3, 0); g.lineTo(r * 1.75, 0); g.stroke(); }
    g.restore();
    g.fillStyle = sc.sky === 'golden' ? '#ffb347' : '#ffd84a'; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
  }

  function cloud(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    g.fillStyle = grey ? (sc.weather === 'rain' ? '#6f7a87' : '#aeb7c1') : night ? 'rgba(200,210,240,0.25)' : '#ffffff';
    for (const [dx, dy, r] of [[-1.1, 0.2, 0.7], [-0.4, -0.25, 0.9], [0.5, -0.1, 0.8], [1.2, 0.25, 0.6], [0, 0.3, 0.8]]) {
      g.beginPath(); g.arc(cx + dx * 40 * s, cy + dy * 40 * s, r * 40 * s, 0, Math.PI * 2); g.fill();
    }
  }

  function hills(g: CanvasRenderingContext2D) {
    const [light, dark] = GROUND[sc.season];
    const layers = [[0.0, grey ? '#8f9aa3' : rgba(dark, 0.55), 0.06], [0.04, light, 0.035]] as const;
    for (const [lift, color, amp] of layers) {
      g.fillStyle = color;
      g.beginPath(); g.moveTo(X, Y + Hz);
      for (let i = 0; i <= 40; i++) {
        const x = X + (i / 40) * Wz;
        const y = horizon - Hz * lift + Math.sin(i * 0.35 + style.seed) * Hz * amp + Math.sin(i * 0.9) * Hz * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(X + Wz, Y + Hz); g.closePath(); g.fill();
    }
  }

  function tree(g: CanvasRenderingContext2D, x: number, base: number, s: number, pine: boolean, c: string, t: number) {
    const sway = Math.sin(t * 0.8 + x) * 3;
    g.fillStyle = '#6b4a2e'; g.fillRect(x - 7 * s, base - 70 * s, 14 * s, 70 * s);
    if (pine) {
      g.fillStyle = sc.season === 'winter' ? '#2f5d4a' : '#2f6d3a';
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + sway, base - (190 - k * 45) * s); g.lineTo(x - (60 - k * 6) * s, base - (60 + k * 5) * s - k * 30 * s); g.lineTo(x + (60 - k * 6) * s, base - (60 + k * 5) * s - k * 30 * s); g.closePath(); g.fill(); }
      if (sc.season === 'winter') { g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + sway, base - 190 * s); g.lineTo(x - 22 * s, base - 150 * s); g.lineTo(x + 22 * s, base - 150 * s); g.fill(); }
      return;
    }
    if (sc.season === 'winter') { g.strokeStyle = '#6b4a2e'; g.lineWidth = 5 * s; for (const a of [-0.6, 0.6, -0.2, 0.3]) { g.beginPath(); g.moveTo(x, base - 60 * s); g.lineTo(x + Math.sin(a) * 60 * s + sway, base - 150 * s); g.stroke(); } return; }
    g.fillStyle = c;
    for (const [dx, dy, r] of [[0, -150, 62], [-45, -115, 48], [45, -115, 48], [0, -100, 52]]) { g.beginPath(); g.arc(x + dx * s + sway, base + dy * s, r * s, 0, Math.PI * 2); g.fill(); }
  }

  function grass(g: CanvasRenderingContext2D, t: number) {
    const [light] = GROUND[sc.season];
    g.strokeStyle = sc.season === 'winter' ? '#ffffff' : rgba(light, 0.9);
    g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x = X + (i / 90) * Wz, y = Y + Hz - 4;
      const bend = Math.sin(t * 2 + i * 0.7) * 6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + bend * 0.5, y - 18, x + bend, y - 30 - (i % 5) * 4); g.stroke();
    }
    for (const f of flowers) {
      const fx = X + f.x * Wz, fy = horizon + (Y + Hz - horizon) * (0.25 + f.y * 0.7);
      g.fillStyle = f.c; g.beginPath(); g.arc(fx, fy, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffcf3f'; g.beginPath(); g.arc(fx, fy, 2, 0, Math.PI * 2); g.fill();
    }
  }

  function water(g: CanvasRenderingContext2D, t: number) {
    const gr = g.createLinearGradient(0, horizon, 0, Y + Hz);
    gr.addColorStop(0, night ? '#1b2b5a' : grey ? '#6c7d8c' : '#3f8fc9'); gr.addColorStop(1, night ? '#0b1530' : '#1f5f99');
    g.fillStyle = gr; g.fillRect(X, horizon, Wz, Y + Hz - horizon);
    if (!grey) { g.fillStyle = night ? 'rgba(253,246,216,0.35)' : 'rgba(255,230,150,0.45)'; for (let k = 0; k < 8; k++) g.fillRect(X + Wz * 0.72 + Math.sin(t * 2 + k) * 8, horizon + 12 + k * 22, Wz * 0.12 - k * 6, 5); }
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
    for (let r = 0; r < 7; r++) {
      const y = horizon + 30 + r * ((Y + Hz - horizon - 60) / 7);
      g.beginPath();
      for (let i = 0; i <= 30; i++) { const x = X + (i / 30) * Wz; g.lineTo(x, y + Math.sin(i * 0.8 + t * 1.6 + r) * 4); }
      g.stroke();
    }
    g.fillStyle = sc.season === 'winter' ? '#e9eef3' : '#e8cf96';
    g.beginPath(); g.moveTo(X, Y + Hz); g.quadraticCurveTo(X + Wz * 0.4, Y + Hz - Hz * 0.12, X + Wz, Y + Hz - Hz * 0.04); g.lineTo(X + Wz, Y + Hz); g.fill();
  }

  function city(g: CanvasRenderingContext2D) {
    for (const b of buildings) {
      const bx = X + b.x * Wz, bw = b.w * Wz, bh = b.h * Hz, by = horizon - bh + Hz * 0.08;
      g.fillStyle = night ? '#1c2440' : grey ? '#6f7883' : '#8a9bb0';
      g.fillRect(bx, by, bw, bh + Hz);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 3; c++) {
        if (!b.lit[(r * 3 + c) % 24]) continue;
        g.fillStyle = night ? '#ffd56b' : 'rgba(255,255,255,0.6)';
        g.fillRect(bx + bw * (0.15 + c * 0.28), by + 12 + r * 22, bw * 0.16, 12);
      }
    }
    g.fillStyle = night ? '#141a2e' : '#5f6670'; g.fillRect(X, horizon + Hz * 0.08, Wz, Y + Hz - horizon);
    for (let i = 0; i < 4; i++) {
      const lx = X + Wz * (0.15 + i * 0.24), ly = horizon + Hz * 0.08;
      g.fillStyle = '#2b2b2b'; g.fillRect(lx, ly - 120, 6, 120);
      if (night) { const gl = g.createRadialGradient(lx + 3, ly - 124, 2, lx + 3, ly - 124, 70); gl.addColorStop(0, 'rgba(255,200,110,0.9)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gl; g.fillRect(lx - 70, ly - 194, 140, 140); }
    }
  }

  function home(g: CanvasRenderingContext2D, t: number) {
    // Стена, окно с небом и погодой снаружи, стол, чашка, тёплая лампа.
    g.fillStyle = night ? '#3a2f3f' : '#efe0c9'; g.fillRect(X, Y, Wz, Hz);
    const wx = X + Wz * 0.18, wy = Y + Hz * 0.1, ww = Wz * 0.64, wh = Hz * 0.42;
    g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
    const [top, bottom] = SKY[sc.sky]; const gr = g.createLinearGradient(0, wy, 0, wy + wh);
    gr.addColorStop(0, grey && !night ? '#7d8a99' : top); gr.addColorStop(1, grey && !night ? '#c9d1d9' : bottom); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    if (night) for (const s of stars.slice(0, 30)) { g.fillStyle = 'rgba(255,255,240,0.8)'; g.fillRect(wx + s.x * ww, wy + s.y * wh, 2, 2); }
    if (sc.weather === 'rain') { g.strokeStyle = 'rgba(220,230,255,0.6)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = wx + ((i * 37 + t * 300) % ww), y = wy + ((i * 53 + t * 600) % wh); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 18); g.stroke(); } }
    g.restore();
    g.strokeStyle = '#7a5a3a'; g.lineWidth = 14; g.strokeRect(wx, wy, ww, wh);
    g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.lineWidth = 8; g.stroke();
    const lamp = g.createRadialGradient(X + Wz * 0.85, Y + Hz * 0.15, 10, X + Wz * 0.85, Y + Hz * 0.15, Wz * 0.6);
    lamp.addColorStop(0, 'rgba(255,200,120,0.45)'); lamp.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = lamp; g.fillRect(X, Y, Wz, Hz);
    g.fillStyle = '#8b5e3c'; g.fillRect(X, Y + Hz * 0.72, Wz, Hz * 0.06); g.fillStyle = '#6f4a2f'; g.fillRect(X, Y + Hz * 0.78, Wz, Hz * 0.22);
    const cx = X + Wz * 0.5, cy = Y + Hz * 0.72;
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.roundRect(cx - 34, cy - 60, 68, 60, 10); g.fill();
    g.strokeStyle = '#f4f1ea'; g.lineWidth = 8; g.beginPath(); g.arc(cx + 40, cy - 32, 16, -Math.PI / 2, Math.PI / 2); g.stroke();
    if (sc.steam) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4; for (let k = 0; k < 3; k++) { g.beginPath(); const sx = cx - 14 + k * 14; for (let i = 0; i < 12; i++) g.lineTo(sx + Math.sin(i * 0.6 + t * 2 + k) * 6, cy - 70 - i * 7); g.stroke(); } }
  }

  function road(g: CanvasRenderingContext2D, t: number) {
    g.fillStyle = '#4a4f57'; g.beginPath(); g.moveTo(X + Wz * 0.46, horizon); g.lineTo(X + Wz * 0.54, horizon); g.lineTo(X + Wz * 0.95, Y + Hz); g.lineTo(X + Wz * 0.05, Y + Hz); g.fill();
    g.fillStyle = '#f2d23c';
    for (let i = 0; i < 6; i++) { const p = ((i / 6 + t * 0.15) % 1); const y = horizon + (Y + Hz - horizon) * p * p; const w = 4 + 14 * p; g.fillRect(X + Wz / 2 - w / 2, y, w, 6 + 30 * p); }
  }

  function figures(g: CanvasRenderingContext2D, t: number, beat: number) {
    if (!sc.people) return;
    const n = sc.people === 3 ? 4 : sc.people;
    const base = sc.setting === 'home' ? Y + Hz * 0.72 : Y + Hz * 0.9;
    const cx = X + Wz * (sc.setting === 'home' ? 0.24 : 0.36);
    if (sc.picnic) {
      g.fillStyle = '#d94f4f'; g.beginPath(); g.moveTo(cx - 150, base + 10); g.lineTo(cx + 190, base + 10); g.lineTo(cx + 150, base - 40); g.lineTo(cx - 110, base - 40); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 6; i++) g.fillRect(cx - 120 + i * 50, base - 38, 18, 46);
      g.fillStyle = '#b5824b'; g.beginPath(); g.roundRect(cx + 110, base - 70, 60, 40, 8); g.fill();
    }
    for (let i = 0; i < n; i++) {
      const fx = cx - 60 + i * 70, bob = Math.sin(t * 3 + i) * 3 + beat * 6, c = people[i % people.length];
      const h = sc.picnic ? 90 : 130;
      g.fillStyle = c; g.beginPath(); g.roundRect(fx - 22, base - h - bob, 44, h, 20); g.fill();
      g.fillStyle = '#f1c7a1'; g.beginPath(); g.arc(fx, base - h - 26 - bob, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3b2a20'; g.beginPath(); g.arc(fx, base - h - 34 - bob, 22, Math.PI, Math.PI * 2); g.fill();
      if (n === 2 && i === 0) { g.strokeStyle = '#f1c7a1'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(fx + 18, base - h * 0.55 - bob); g.lineTo(fx + 52, base - h * 0.55 - bob); g.stroke(); }
    }
  }

  function flock(g: CanvasRenderingContext2D, t: number) {
    g.strokeStyle = night ? '#ffffff' : '#2b2b2b'; g.lineWidth = 3; g.lineCap = 'round';
    for (const b of birds) {
      const x = X + ((b.o + t * b.v) % 1.2 - 0.1) * Wz, y = Y + b.y * Hz + Math.sin(t * 2 + b.o * 9) * 6, s = 14 * b.s, flap = Math.sin(t * 9 + b.o * 20) * 0.5;
      g.beginPath(); g.moveTo(x - s, y - s * flap); g.quadraticCurveTo(x - s / 2, y - s * 0.4, x, y); g.quadraticCurveTo(x + s / 2, y - s * 0.4, x + s, y - s * flap); g.stroke();
    }
  }

  /** Фото дня — полароидом внутри рисунка: рисунок рассказывает, фото напоминает. */
  function polaroid(g: CanvasRenderingContext2D, index: number) {
    const p = photos[index];
    if (!p) return;
    const pw = Wz * 0.34, ph = pw * 1.08, px = X + Wz - pw - 26, py = Y + Hz - ph - 40;
    g.save(); g.translate(px + pw / 2, py + ph / 2); g.rotate(0.06 - (style.seed % 5) * 0.02);
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 20; g.shadowOffsetY = 8;
    g.fillStyle = '#fbf8f2'; g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.shadowColor = 'transparent';
    const iw = pw - 24, ih = iw;
    const k = Math.max(iw / p.w, ih / p.h), sw = iw / k, sh = ih / k;
    g.drawImage(p.img, (p.w - sw) / 2, (p.h - sh) / 2, sw, sh, -iw / 2, -ph / 2 + 12, iw, ih);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-50, -ph / 2 - 14, 100, 26);
    g.restore();
  }

  return {
    draw(g: CanvasRenderingContext2D, t: number, photoIndex: number, beat: number) {
      g.save();
      g.beginPath(); g.rect(X, Y, Wz, Hz); g.clip();
      if (sc.setting === 'home') home(g, t);
      else {
        sky(g); sunMoon(g, t);
        for (const c of clouds) cloud(g, X + (((c.x + t * c.v) % 1.3) - 0.15) * Wz, Y + c.y * Hz, c.s);
        flock(g, t);
        if (sc.setting === 'water') water(g, t);
        else if (sc.setting === 'city') city(g);
        else {
          hills(g);
          if (sc.setting === 'road') road(g, t);
          for (const tr of trees) tree(g, X + tr.x * Wz, horizon + Hz * 0.12, tr.s * (Hz / 900), tr.pine, tr.c, t);
          grass(g, t);
        }
      }
      figures(g, t, beat);
      polaroid(g, photoIndex);
      // Свет и погода поверх: золотой час теплее, пасмурно — мягче.
      if (sc.sky === 'golden') { g.fillStyle = 'rgba(255,170,80,0.12)'; g.fillRect(X, Y, Wz, Hz); }
      g.restore();
    },
  };
}
