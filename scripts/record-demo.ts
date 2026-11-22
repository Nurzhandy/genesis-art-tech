// Запись демо-видео «Дневник атмосферы» для сдачи на Genesis Hackathon (22.11).
// Настоящий Chrome (channel 'chrome') проходит сценарий docs/submission/video-script.md как человек:
// плавная мышь, паузы под анимации. Картинка снимается прямо из вкладки (CDP screencast, ровно 1920×1080),
// звук — ffmpeg с виртуального устройства (avfoundation), куда Chrome отправляет звук через setSinkId.
// Код сайта не трогает: курсор и маршрут звука — это обвязка записи, внедряется только в этот браузер.
//
// Запуск (playwright не в зависимостях проекта — ставится отдельно, чтобы не трогать package-lock.json):
//   mkdir -p /tmp/pw && npm --prefix /tmp/pw i playwright
//   NODE_PATH=/tmp/pw/node_modules npx tsx scripts/record-demo.ts [--out video/raw] [--audio "Microsoft Teams Audio"] [--trial]
//
// На выходе в --out: frames/*.jpg + frames.txt (время каждого кадра), audio.wav, marks.json (начала сцен и вырезки).
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
// playwright не в зависимостях проекта (см. запуск выше), поэтому без его типов: иначе `next build`
// (tsconfig берёт все **/*.ts) не нашёл бы модуль и упал на проверке типов.
const { chromium } = require('playwright') as { chromium: any };
type Page = any;
type CDPSession = any;
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SITE = process.env.SITE ?? 'https://genesis-art-tech.vercel.app';
const FIXTURE = path.resolve('fixtures/demo/1-osenniy-park');
const DEMO_DAY = '/day/b54ce047-bfa7-4a74-a286-97548e9c86c0';
const W = 1920, H = 1080, FPS = 30;

const args = process.argv.slice(2);
const opt = (name: string, def: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const OUT = path.resolve(opt('out', 'video/raw'));
const AUDIO_DEVICE = opt('audio', 'Microsoft Teams Audio');
const TRIAL = args.includes('--trial');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- метки сцен ----------
let t0 = 0; // epoch-секунды первого кадра записи
const marks: { name: string; t: number }[] = [];
function mark(name: string) {
  const t = Date.now() / 1000 - t0;
  marks.push({ name, t });
  const mm = Math.floor(t / 60), ss = (t % 60).toFixed(1).padStart(4, '0');
  console.log(`[${mm}:${ss}] ${name}`);
}

// ---------- картинка: CDP screencast → JPEG-кадры с временем ----------
async function startScreencast(page: Page) {
  const dir = path.join(OUT, 'frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const list = fs.createWriteStream(path.join(OUT, 'frames.txt'));
  const cdp: CDPSession = await page.context().newCDPSession(page);
  let n = 0, last = 0;
  cdp.on('Page.screencastFrame', (f: { sessionId: number; data: string; metadata: { timestamp?: number } }) => {
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    const ts = f.metadata.timestamp ?? Date.now() / 1000;
    if (!t0) t0 = ts;
    if (ts - last < 1 / FPS - 0.004) return; // оставляем ~30 к/с
    last = ts;
    const name = `${String(n++).padStart(6, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64'));
    list.write(`${name} ${ts.toFixed(4)}\n`);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  return async () => { await cdp.send('Page.stopScreencast').catch(() => {}); list.end(); console.log(`кадров: ${n}`); };
}

// ---------- звук: ffmpeg avfoundation с виртуального устройства ----------
function audioIndex(name: string): string {
  let out = '';
  try { execFileSync('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { stdio: 'pipe' }); }
  catch (e) { out = String((e as { stderr?: Buffer }).stderr ?? ''); }
  const audio = out.split('audio devices:')[1] ?? '';
  const m = audio.split('\n').map((l) => l.match(/\[(\d+)\] (.+)$/)).find((x) => x && x[2].trim() === name);
  if (!m) throw new Error(`Нет аудиоустройства «${name}». Есть:\n${audio}`);
  return m[1];
}
function startAudio(): () => Promise<void> {
  const file = path.join(OUT, 'audio.wav');
  const ff: ChildProcess = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    // виртуальное устройство молчит без звука и не шлёт данные: метки по системным часам + заполнение пауз тишиной
    '-use_wallclock_as_timestamps', '1', '-f', 'avfoundation', '-i', `:${audioIndex(AUDIO_DEVICE)}`,
    '-af', 'aresample=async=1:first_pts=0', '-ac', '2', '-ar', '48000', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  return () => new Promise((res) => {
    const stopEpoch = Date.now() / 1000;
    ff.on('exit', () => {
      // начало звука = момент остановки минус длина файла (точнее, чем ждать старта устройства)
      const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
      fs.writeFileSync(path.join(OUT, 'audio.json'), JSON.stringify({ start: stopEpoch - dur, duration: dur }));
      res();
    });
    ff.stdin?.write('q');
  });
}

// ---------- обвязка страницы: видимый курсор и маршрут звука в виртуальное устройство ----------
// Обвязка — обычной JS-строкой: tsx при компиляции вставляет в функции служебный __name(), которого в браузере нет.
const harness = (sinkLabel: string) => `(() => {
  const SINK = ${JSON.stringify(sinkLabel)};
  // Курсор: в screencast системной мыши нет, рисуем свою (только в этом браузере).
  let pos = [-100, -100];
  function cursor() {
    let c = document.getElementById('__demo_cursor');
    if (c || !document.documentElement) return c;
    c = document.createElement('div');
    c.id = '__demo_cursor';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3l16 9-7 2-3 7z" fill="#fff" stroke="#1c1612" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transition: 'scale .12s', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' });
    c.style.transform = 'translate(' + (pos[0] - 5) + 'px,' + (pos[1] - 3) + 'px)';
    document.documentElement.appendChild(c);
    return c;
  }
  addEventListener('mousemove', (e) => { pos = [e.clientX, e.clientY]; const c = cursor(); if (c) c.style.transform = 'translate(' + (e.clientX - 5) + 'px,' + (e.clientY - 3) + 'px)'; }, true);
  addEventListener('mousedown', () => { const c = cursor(); if (c) c.style.scale = '0.82'; }, true);
  addEventListener('mouseup', () => { const c = cursor(); if (c) c.style.scale = '1'; }, true);
  document.addEventListener('DOMContentLoaded', cursor);
  // курсор держим поверх всего, даже если страница перерисовала <html>
  setInterval(() => { const c = cursor(); if (c && c !== document.documentElement.lastElementChild) document.documentElement.appendChild(c); }, 500);

  // Звук: весь вывод вкладки → виртуальное устройство (setSinkId), системный вывод не трогаем.
  // Имена выходов браузер показывает только после getUserMedia в документе — микрофон открывается на миг.
  const log = (window.__demoSinks = []);
  let sink = null;
  const pick = (ds) => { const d = ds.find((d) => d.kind === 'audiooutput' && d.label.includes(SINK)); return d ? d.deviceId : null; };
  const findSink = () => (sink = sink || navigator.mediaDevices.enumerateDevices().then(async (ds) => {
    if (pick(ds)) return pick(ds);
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return pick(await navigator.mediaDevices.enumerateDevices());
  }).catch((e) => { log.push('find-err ' + e); return null; }));
  // play — сразу (не теряем нажатие), маршрут — следом. Если элемент заведён в WebAudio,
  // setSinkId отказывает, и звук идёт через AudioContext, перенаправленный ниже.
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const el = this, r = play.call(this);
    findSink().then((id) => id && el.setSinkId && el.setSinkId(id).then(() => log.push('media-ok'), () => log.push('media-webaudio')));
    return r;
  };
  const AC = window.AudioContext;
  if (AC) {
    window.AudioContext = class extends AC {
      constructor(o) {
        super(o);
        const self = this;
        findSink().then((id) => id && self.setSinkId && self.setSinkId(id).then(() => log.push('ac-ok'), (e) => log.push('ac-err ' + e)));
      }
    };
  }
})();`;

// ---------- мышь «как человек» ----------
let cur = { x: W / 2, y: H / 2 };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
async function move(page: Page, x: number, y: number, ms = 700) {
  const from = { ...cur }, steps = Math.max(8, Math.round(ms / 16));
  const bend = (Math.random() - 0.5) * 0.18; // лёгкая дуга
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps);
    const nx = from.x + (x - from.x) * k + (y - from.y) * bend * Math.sin(Math.PI * k);
    const ny = from.y + (y - from.y) * k - (x - from.x) * bend * Math.sin(Math.PI * k);
    await page.mouse.move(nx, ny);
    await sleep(ms / steps);
  }
  cur = { x, y };
}
async function centerOf(page: Page, selector: string, nth: 'first' | 'last' = 'first') {
  const loc = nth === 'first' ? page.locator(selector).first() : page.locator(selector).last();
  await loc.waitFor({ state: 'visible', timeout: 30000 });
  await loc.scrollIntoViewIfNeeded();
  const b = (await loc.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function click(page: Page, selector: string, opts: { ms?: number; nth?: 'first' | 'last'; pause?: number } = {}) {
  const p = await centerOf(page, selector, opts.nth);
  await move(page, p.x, p.y, opts.ms ?? 800);
  await sleep(opts.pause ?? 250);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await move(page, from.x, from.y, 600);
  await page.mouse.down();
  await sleep(120);
  await move(page, to.x, to.y, 900);
  await sleep(80);
  await page.mouse.up();
  await sleep(250);
}
async function wheel(page: Page, total: number, ms: number) {
  const steps = Math.round(ms / 50), dy = total / steps;
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy); await sleep(50); }
}
async function wander(page: Page, ms: number, box = { x: 300, y: 200, w: 1300, h: 650 }) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await move(page, box.x + Math.random() * box.w, box.y + Math.random() * box.h, 1400 + Math.random() * 900);
    await sleep(300);
  }
}
/** Новый предмет на доске: помечаем уже лежащие (дети контейнера доски), ждём новый и возвращаем его центр. */
async function tagItems(page: Page) {
  await page.evaluate(() => {
    const box = document.querySelector('figure')?.parentElement ?? document.querySelector('[style*="pop-in"]')?.parentElement;
    box?.setAttribute('data-demo-board', '');
    box?.querySelectorAll(':scope > *').forEach((e) => e.setAttribute('data-demo-old', ''));
  });
}
async function newItem(page: Page, sel = '[data-demo-board] > :not([data-demo-old])') {
  return centerOf(page, sel, 'last');
}

// ---------- сжатые копии фото из fixtures (те же снимки, загрузка быстрее) ----------
async function preparePhotos(): Promise<string[]> {
  const sharp = (await import('sharp')).default;
  const dir = path.join(OUT, 'photos');
  fs.mkdirSync(dir, { recursive: true });
  const src = fs.readdirSync(path.join(FIXTURE, 'photos')).filter((f) => /\.jpe?g$/i.test(f)).sort();
  const out: string[] = [];
  for (const f of src) {
    const to = path.join(dir, f);
    if (!fs.existsSync(to)) await sharp(path.join(FIXTURE, 'photos', f)).rotate().resize(1600, 1600, { fit: 'inside' }).jpeg({ quality: 86 }).toFile(to);
    out.push(to);
  }
  return out;
}

// =====================================================================
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const text = fs.readFileSync(path.join(FIXTURE, 'text.md'), 'utf8').trim();
  const songUrl = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'song.json'), 'utf8')).url as string;
  const date = fs.readFileSync(path.join(FIXTURE, 'date.txt'), 'utf8').trim();
  const place = fs.readFileSync(path.join(FIXTURE, 'place.txt'), 'utf8').trim();
  const photos = await preparePhotos();

  const browser = await chromium.launch({
    channel: 'chrome', headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--autoplay-policy=no-user-gesture-required',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling',
      '--hide-scrollbars', '--use-fake-ui-for-media-stream', `--window-size=${W},${H}`, '--window-position=0,0'],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'ru-RU', timezoneId: 'Asia/Almaty' });
  await ctx.grantPermissions(['microphone'], { origin: SITE }); // нужно, чтобы видеть имена аудиовыходов для setSinkId
  await ctx.addInitScript({ content: harness(AUDIO_DEVICE) });
  const page = await ctx.newPage();
  page.on('dialog', (d: any) => void d.accept(d.type() === 'prompt' ? songUrl : undefined));

  // прогрев: разрешение на имена устройств выдаётся до записи
  await page.goto(SITE + '/login');
  await page.evaluate(() => navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {}));
  const sinkOk = await page.evaluate((l: string) => navigator.mediaDevices.enumerateDevices().then((d) => d.some((x) => x.kind === 'audiooutput' && x.label.includes(l))), AUDIO_DEVICE);
  console.log(sinkOk ? `звук вкладки → «${AUDIO_DEVICE}»` : `ВНИМАНИЕ: выход «${AUDIO_DEVICE}» не найден, звук пойдёт в системный вывод`);

  const stopAudio = startAudio();
  await sleep(500);
  const stopVideo = await startScreencast(page);
  await sleep(300);

  let dayUrl = '';
  try {
    if (TRIAL) {
      mark('trial');
      await page.goto(SITE + DEMO_DAY);
      await click(page, 'text=/Открыть день|Оживить день/');
      await wander(page, 4000);
      console.log('маршрут звука:', await page.evaluate(() => JSON.stringify((window as unknown as { __demoSinks?: unknown }).__demoSinks)));
      await wander(page, 5000);
    } else {
      // 1. Заставка
      mark('intro');
      await page.goto(SITE + '/?intro=1');
      await page.mouse.move(cur.x, cur.y);
      await sleep(9500);

      // 2. Лендинг: медленная прокрутка до манифеста
      mark('landing');
      await move(page, 1300, 700, 900);
      await wheel(page, 800, 4500);
      await sleep(2500);
      await click(page, 'header button:has-text("Начать")', { ms: 1100, pause: 500 });

      // 3. Главная → стол → дневник книгой → доска дневника
      await page.waitForURL('**/home', { timeout: 20000 });
      mark('home');
      await sleep(2500);
      await move(page, 1000, 700, 900);
      await click(page, 'a[href$="/board"]:has-text("Мои дни")', { ms: 1000, pause: 500 });
      await page.waitForURL('**/board**', { timeout: 20000 });
      await sleep(6000);

      // 4. «＋ день» → доска дня
      mark('dayboard');
      await click(page, 'button:has-text("＋ ДЕНЬ"), button:has-text("＋ день")', { ms: 1000 });
      await page.waitForURL('**/day/*/board', { timeout: 20000 });
      dayUrl = page.url().replace(/\/board.*$/, '');
      fs.writeFileSync(path.join(OUT, 'day.txt'), dayUrl);
      await page.locator('button:has-text("Собрать день")').waitFor({ timeout: 20000 });
      await sleep(1800);
      await page.locator('input[aria-label="Дата дня"]').fill(date);
      await click(page, 'input[aria-label="Город"]', { ms: 700 });
      await page.keyboard.type(place, { delay: 90 });
      await sleep(400);
      // заметка: двойной щелчок по пустому месту
      await move(page, 470, 330, 900);
      await page.mouse.dblclick(470, 330);
      await sleep(500);
      await page.keyboard.type(text, { delay: 14 });
      await sleep(600);
      await page.keyboard.press('Escape');
      await sleep(400);
      // 3 фото через input[type=file], каждое относим на своё место
      mark('photos');
      const spots = [{ x: 960, y: 360 }, { x: 1270, y: 330 }, { x: 1110, y: 720 }];
      for (let i = 0; i < photos.length && i < 3; i++) {
        await tagItems(page);
        await move(page, 1200, 960, 600); // к кнопке «▣ Фото»
        await page.locator('input[type=file]').setInputFiles(photos[i]);
        const p = await newItem(page, 'figure:not([data-demo-old])');
        await drag(page, p, spots[i]);
      }
      // фото на доске появляются после перезагрузки (на свежезагруженных — заглушки); этот кусок вырезаем
      mark('cut:photos-reload');
      await page.reload();
      await page.waitForFunction(() => document.querySelectorAll('figure img').length >= 3, null, { timeout: 60000 });
      await sleep(1500);
      mark('cut-end:photos-reload');
      await sleep(800);
      // песня: ◉ → ссылка из song.json (диалог принимает обвязка)
      mark('song');
      await tagItems(page);
      await click(page, 'nav button:has-text("◉")', { ms: 900 });
      const s = await newItem(page);
      await page.waitForTimeout(1800); // обложка
      await drag(page, s, { x: 1720, y: 560 });
      await sleep(800);
      // капля настроения: M → «уют», «восторг»
      mark('mood');
      await move(page, 760, 820, 700);
      await page.keyboard.press('m');
      await sleep(900);
      await click(page, 'button:has-text("уют")', { nth: 'last', ms: 800 });
      await sleep(400);
      await click(page, 'button:has-text("восторг")', { nth: 'last', ms: 700 });
      await sleep(900);
      await tagItems(page);
      await click(page, 'button:has-text("положить на доску")', { ms: 700 });
      const m = await newItem(page);
      await sleep(700);
      await drag(page, m, { x: 760, y: 860 });
      await move(page, 1150, 900, 900);
      await sleep(1500);

      // 5. «Собрать день»: ожидание вырезаем, анимацию слёта оставляем
      mark('assemble');
      await click(page, 'button:has-text("Собрать день")', { ms: 1000, pause: 400 });
      await move(page, 1700, 980, 1200);
      await page.waitForURL((u: URL) => /\/day\/[^/]+$/.test(u.pathname), { timeout: 180000 });
      mark('day-arrived');
      await page.locator('button:has-text("Войти в день")').waitFor({ timeout: 60000 });
      await page.waitForFunction(() => !document.body.innerText.includes('рисую день'), null, { timeout: 90000 }).catch(() => {});
      mark('poster-ready');
      await sleep(2500);

      // 6. Страница дня: «Оживить день» — постер оживает под песню
      mark('alive');
      await click(page, 'text=/Открыть день|Оживить день/', { ms: 1000 });
      await move(page, 1350, 300, 1500);
      await wander(page, 12000, { x: 860, y: 150, w: 600, h: 500 });
      // «Войти в день»
      mark('enter');
      await click(page, 'button:has-text("Войти в день")', { ms: 900 });
      await sleep(1500);
      await wander(page, 13500);
      await click(page, 'button:has-text("Выйти из дня")', { ms: 900 });
      await sleep(1500);

      // 7. «Как собран этот день»: 3 слоя
      mark('layers');
      await click(page, 'button:has-text("Как собран этот день")', { ms: 900 });
      await sleep(3500);
      for (const n of [2, 4, 6]) {
        const p = await centerOf(page, `[role=dialog] button:has-text("${n} ")`, 'first').catch(() => null);
        if (p) { await move(page, p.x, p.y, 1000); await sleep(2200); }
      }
      await click(page, 'button:has-text("Собрать обратно")', { ms: 900 });
      await sleep(1200);

      // 8. «Папка дня» и «Доска этого дня»
      mark('folder');
      await move(page, 1200, 600, 600);
      const fy = await page.evaluate(() => {
        const p = [...document.querySelectorAll('p')].find((e) => /^папка дня$/i.test(e.textContent?.trim() ?? ''));
        return p ? p.getBoundingClientRect().top - 140 : 1500;
      });
      await wheel(page, fy, 2500);
      await sleep(3500);
      await wheel(page, -fy - 200, 1500);
      await sleep(700);
      mark('dayboard-link');
      await click(page, 'a:has-text("Доска этого дня")', { ms: 900 });
      await page.waitForURL('**/board', { timeout: 20000 });
      await sleep(3500);

      // 9. Архив демо-дневника: коридор с песнями, книга
      mark('archive');
      await page.goto(SITE + '/diary/demo');
      await sleep(2500);
      await click(page, 'button:has-text("коридор")', { ms: 900 });
      await sleep(1200);
      const top = await page.evaluate(() => (document.querySelector('button[aria-pressed]')?.closest('section')?.getBoundingClientRect().top ?? 260) + scrollY);
      await wheel(page, top, 900);
      await sleep(500);
      await click(page, 'button:has-text("Слушать песни дней")', { ms: 800 });
      await move(page, 960, 600, 800);
      const depth = await page.evaluate(() => document.body.scrollHeight - innerHeight - scrollY);
      mark('corridor-walk');
      await wheel(page, depth, 18000);
      await sleep(2000);
      mark('book');
      await page.evaluate(() => scrollTo({ top: 0 }));
      await sleep(400);
      await click(page, 'button:has-text("Слушать песни дней"), button:has-text("Песни звучат")', { ms: 500 }).catch(() => {});
      await click(page, 'button:has-text("книга")', { ms: 900 });
      await sleep(2000);
      for (let i = 0; i < 4; i++) { await click(page, 'button:has-text("вперёд")', { ms: 600 }); await sleep(1600); }
      await sleep(1500);
      mark('end');
    }
  } finally {
    await stopVideo();
    await stopAudio();
    fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ t0, marks, day: dayUrl }, null, 1));
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
