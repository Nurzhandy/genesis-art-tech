// Марка сезона, штемпель с датой и бирки из анализа (план 20.11, B3). Одинаковое место у всех дней.
import type { StyleParams } from '@/lib/types';
import { LAYOUT } from '@/lib/style/constants';
import { rgba } from './draw';
import type { Fonts } from './types';

function seasonGlyph(g: CanvasRenderingContext2D, season: string, r: number, color: string) {
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath();
  switch (season) {
    case 'winter': // снежинка
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        g.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
        g.lineTo(Math.cos(a + 0.5) * r * 0.85, Math.sin(a + 0.5) * r * 0.85);
      }
      g.stroke(); break;
    case 'summer': // солнце
      g.arc(0, 0, r * 0.42, 0, Math.PI * 2); g.fill();
      g.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.stroke(); break;
    case 'spring': // цветок
      for (let k = 0; k < 5; k++) { const a = (k * 2 * Math.PI) / 5; g.moveTo(0, 0); g.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.42, r * 0.22, a, 0, Math.PI * 2); }
      g.fill(); break;
    case 'autumn': // лист
      g.moveTo(0, -r); g.quadraticCurveTo(r, -r * 0.2, 0, r); g.quadraticCurveTo(-r, -r * 0.2, 0, -r); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(0, r * 1.15); g.stroke(); break;
    default:
      g.arc(0, 0, r * 0.5, 0, Math.PI * 2); g.stroke();
  }
}

export function drawStamps(g: CanvasRenderingContext2D, W: number, H: number, style: StyleParams, fonts: Fonts) {
  const st = style.stamps;
  if (!st) return;
  const zone = { x: LAYOUT.photo.x * W, y: LAYOUT.photo.y * H, w: LAYOUT.photo.w * W, h: LAYOUT.photo.h * H };
  const ink = style.palette.ink;
  const stampColor = style.palette.accents[1] ?? style.palette.accents[0];

  // Почтовая марка с зубчатым краем — в правом верхнем углу фото.
  const sw = 104, sh = 126;
  g.save();
  g.translate(zone.x + zone.w - sw * 0.62, zone.y - sh * 0.28);
  g.rotate(0.07);
  g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.fillStyle = '#f6f1e6';
  g.beginPath();
  const tooth = 7;
  for (let x = 0; x <= sw; x += tooth * 2) { g.moveTo(x, 0); g.arc(x, 0, tooth / 2, 0, Math.PI); }
  g.rect(0, 0, sw, sh);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = stampColor;
  g.fillRect(9, 9, sw - 18, sh - 18);
  g.save(); g.translate(sw / 2, sh / 2 - 8); seasonGlyph(g, st.season, 28, 'rgba(255,255,255,0.92)'); g.restore();
  g.font = `600 13px ${fonts.mono}`;
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.textAlign = 'center';
  g.fillText('ДНЕВНИК', sw / 2, sh - 18);
  g.restore();

  // Штемпель с датой поверх края марки.
  g.save();
  g.translate(zone.x + zone.w - sw * 0.95, zone.y + sh * 0.42);
  g.rotate(-0.18);
  g.strokeStyle = rgba(ink, 0.55); g.lineWidth = 2.5;
  g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 38, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 50; x < 150; x += 4) g.lineTo(x, -12 + k * 12 + Math.sin(x / 8) * 3); g.stroke(); }
  g.fillStyle = rgba(ink, 0.65); g.font = `700 13px ${fonts.mono}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(st.date, 0, 0, 70);
  g.restore();

  // Бирки из анализа — в левом нижнем углу фото, форма по технике.
  g.save();
  g.font = `600 20px ${fonts.mono}`;
  g.textBaseline = 'middle';
  let x = zone.x + 14;
  const y = zone.y + zone.h - 34;
  for (const tag of st.tags) {
    const text = tag.text.toUpperCase();
    const w = g.measureText(text).width + 28;
    if (x + w > zone.x + zone.w * 0.68) break;   // не залезать на предмет-песню справа
    g.fillStyle = rgba(style.palette.paper, 0.88);
    g.strokeStyle = rgba(ink, 0.7); g.lineWidth = 2;
    g.beginPath();
    if (st.shape === 'square') g.rect(x, y - 18, w, 36);
    else if (st.shape === 'ticket') {
      g.moveTo(x, y - 18); g.lineTo(x + w, y - 18); g.arc(x + w, y, 8, -Math.PI / 2, Math.PI / 2, true);
      g.lineTo(x, y + 18); g.arc(x, y, 8, Math.PI / 2, -Math.PI / 2, true);
    } else g.roundRect(x, y - 18, w, 36, 18);
    g.fill(); g.stroke();
    g.fillStyle = ink; g.fillText(text, x + 14, y + 1);
    x += w + 10;
  }
  g.restore();
}
