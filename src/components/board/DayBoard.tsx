'use client';
// Доска дня (план 21.11, человек 2): вместо формы — пустая свободная доска. Человек кладёт заметки, фото,
// песни, рисунки, стикеры и каплю настроения, а «Собрать день» превращает доску в живую страницу.
// Ядро — то же, что у доски дневника (BoardCanvas); здесь шапка с датой и городом, подсказки,
// инструмент «Настроение» и рассказ голосом, который ложится на доску заметкой.
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api } from '@/lib/client/api';
import { useIsMyDiary } from '@/lib/client/diaryKey';
import type { BoardItem } from '@/lib/board/board';
import type { DayRecord } from '@/lib/types';
import { FeelingPicker } from '../FeelingPicker';
import { StoryRecorder, type StoryOutcome } from '../StoryRecorder';
import { BoardCanvas, iconBtn, Tip, uid, type BoardControls } from './BoardCanvas';
import { MoodDrop } from './MoodDrop';

export interface DayBoardMeta { id: string; diaryId: string; date: string; place: string | null; status: DayRecord['status']; title: string | null }

/** Что доска дня отдаёт кнопке «Собрать день» (её делает человек 3). */
export interface DayBoardState { day: DayBoardMeta; date: string; place: string; items: BoardItem[] }

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const noop = () => () => undefined;
const metaKey = (dayId: string) => `dayboard-meta-${dayId}`;
const seenKey = (dayId: string) => `dayboard-seen-${dayId}`;

function readMeta(dayId: string): { date?: string; place?: string } {
  try { return JSON.parse(localStorage.getItem(metaKey(dayId)) ?? '{}'); } catch { return {}; }
}

export function DayBoard({ dayId, opened = false, primary }: { dayId: string; opened?: boolean; primary?: (s: DayBoardState) => React.ReactNode }) {
  const [day, setDay] = useState<DayBoardMeta | null>(null);
  const mine = useIsMyDiary(day?.diaryId ?? '');
  const [date, setDate] = useState('');
  const [place, setPlace] = useState('');
  const [items, setItems] = useState<BoardItem[]>([]);
  const [picker, setPicker] = useState<{ id: string | null; feelings: string[] } | null>(null);
  const [voice, setVoice] = useState(false);
  const controls = useRef<BoardControls | null>(null);
  // Первый вход на доску дня — тот же наезд камеры, что из книги.
  // Читаем только в браузере: на сервере доски ещё нет (null), так что разметка не расходится при гидрации.
  const [firstVisit] = useState(() => {
    try { return typeof window === 'undefined' ? null : !localStorage.getItem(seenKey(dayId)); } catch { return false; }
  });
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => { try { localStorage.setItem(seenKey(dayId), '1'); } catch { /* не критично */ } }, [dayId]);
  const fly = opened || !!firstVisit;

  // Дата и город — в шапке доски; до сборки дня помним их на устройстве, сборка отправит их на сервер.
  useEffect(() => {
    if (!day) return;
    try { localStorage.setItem(metaKey(dayId), JSON.stringify({ date, place })); } catch { /* не критично */ }
  }, [day, dayId, date, place]);

  // Горячая клавиша M — настроение.
  useEffect(() => {
    if (!mine) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || e.metaKey || e.ctrlKey) return;
      if (e.key.toLowerCase() === 'm') setPicker({ id: null, feelings: [] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mine]);

  function saveMood() {
    if (!picker || !picker.feelings.length) { setPicker(null); return; }
    if (picker.id) controls.current?.update(picker.id, { feelings: picker.feelings } as Partial<BoardItem>);
    else {
      const c = controls.current?.center() ?? { x: 0, y: 0 };
      controls.current?.add({ id: uid(), kind: 'mood', x: c.x - 80, y: c.y - 80, rot: 0, feelings: picker.feelings, size: 160 });
    }
    setPicker(null);
  }

  // Рассказ голосом (компонент друга из формы) ложится на доску новой заметкой.
  function applyStory(o: StoryOutcome) {
    const c = controls.current?.center() ?? { x: 0, y: 0 };
    const n = controls.current?.items().filter((i) => i.kind === 'note').length ?? 0;
    controls.current?.add({ id: uid(), kind: 'note', x: c.x - 180 + n * 24, y: c.y - 80 + n * 24, rot: -1, text: o.entry.slice(0, 2000), w: 360, color: '#2b241c', font: 'hand' });
    if (o.place && !place.trim()) setPlace(o.place);
    setVoice(false);
  }

  const pill = 'rounded-full bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider shadow-sm backdrop-blur';
  const ready = day?.status === 'ready';

  if (!mounted) return <p className="fixed inset-0 grid place-items-center bg-[#f1ebe0] font-mono text-xs text-[#7a7064]">раскладываю доску…</p>;

  return (
    <>
      <BoardCanvas
        editable={mine}
        opened={fly}
        controls={controls}
        onItemsChange={setItems}
        load={async () => {
          const r = await api.dayBoard(dayId);
          const saved = readMeta(dayId);
          setDay(r.day);
          setDate(saved.date ?? r.day.date ?? today());
          setPlace(saved.place ?? r.day.place ?? '');
          return { items: r.board.items, urls: r.urls };
        }}
        save={(board) => api.saveDayBoard(dayId, board)}
        upload={(ext) => api.dayBoardUpload(dayId, ext)}
        // Город из GPS фото (айфон пишет координаты), если человек его ещё не вписал.
        onPhoto={(p) => {
          if (!p.gps || place.trim()) return;
          fetch(`/api/place?lat=${p.gps.lat}&lon=${p.gps.lon}`).then((r) => r.json())
            .then((b: { place?: string | null }) => { if (b.place) setPlace((cur) => (cur.trim() ? cur : b.place!)); })
            .catch(() => undefined);
        }}
        onItemClick={(it) => { if (it.kind === 'mood' && mine) setPicker({ id: it.id, feelings: it.feelings }); }}
        header={<>
          <Link href={day ? `/diary/${day.diaryId}/board` : '/'} className={`${pill} text-muted hover:text-foreground`}>← дневник</Link>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-full bg-background/80 px-4 py-1.5 shadow-sm backdrop-blur">
            <span className="font-hand text-xl leading-none">{day?.title ?? 'Новый день'}</span>
            <input type="date" value={date} max={today()} disabled={!mine} onChange={(e) => setDate(e.target.value)} aria-label="Дата дня"
              className="bg-transparent font-mono text-xs text-muted outline-none focus:text-foreground" />
            <input value={place} disabled={!mine} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="город" aria-label="Город"
              className="w-28 border-b border-transparent bg-transparent font-mono text-xs outline-none placeholder:text-muted/60 focus:border-foreground/30" />
          </div>
        </>}
        headerRight={ready ? <Link href={`/day/${dayId}`} className={`${pill} hover:bg-background`}>страница дня →</Link> : undefined}
        tools={<>
          <button type="button" onClick={() => setPicker({ id: null, feelings: [] })} className={iconBtn} aria-label="Настроение">
            <span className="h-5 w-5 rounded-[58%_42%_55%_45%/52%_60%_40%_48%]" style={{ background: 'conic-gradient(#f6c445, #e8574a, #5b7fd1, #5cb88a, #f6c445)' }} />
            <Tip>Настроение (M)</Tip>
          </button>
          <button type="button" onClick={() => setVoice((v) => !v)} aria-pressed={voice} className={iconBtn} aria-label="Рассказ голосом → заметка">🗣<Tip>Рассказ → заметка</Tip></button>
        </>}
        primary={day && primary ? primary({ day, date, place, items }) : undefined}
        renderItem={(it) => (it.kind === 'mood' ? <MoodDrop feelings={it.feelings} size={it.size} /> : null)}
        empty={
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 px-4 text-center" style={{ animation: 'pop-in 0.8s ease-out 0.3s both' }}>
            <p className="font-hand text-4xl opacity-70">Каким был этот день?</p>
            <div className="flex flex-wrap justify-center gap-3 font-mono text-[11px] uppercase tracking-wider opacity-60 sm:gap-4">
              <span className="rounded-md border-2 border-dashed border-current px-5 py-6">двойной щелчок —<br />заметка</span>
              <span className="rounded-md border-2 border-dashed border-current px-5 py-6">перетащите<br />фото</span>
              <span className="rounded-md border-2 border-dashed border-current px-5 py-6">◉ —<br />песня дня</span>
              <span className="rounded-md border-2 border-dashed border-current px-5 py-6">🎙 удерживайте —<br />голосовое</span>
            </div>
          </div>
        }
      />

      {/* Выбор чувств для капли настроения */}
      {picker && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-3 backdrop-blur-sm" onClick={() => setPicker(null)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#f6f1e8] p-5 text-[#2b241c] shadow-2xl" onClick={(e) => e.stopPropagation()}
            style={{ animation: 'pop-in 0.35s ease-out both' }}>
            <div className="mb-4 flex items-center gap-4">
              <MoodDrop feelings={picker.feelings.length ? picker.feelings : []} size={56} />
              <div>
                <p className="text-2xl font-semibold leading-tight">Что вы чувствовали?</p>
                <p className="text-sm text-[#7a7064]">до трёх чувств — капля возьмёт их цвета</p>
              </div>
            </div>
            <FeelingPicker value={picker.feelings} onChange={(f) => setPicker({ ...picker, feelings: f })} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPicker(null)} className="rounded-full px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-[#7a7064]">отмена</button>
              <button type="button" onClick={saveMood} disabled={!picker.feelings.length}
                className="rounded-full bg-[#2b241c] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-[#f6f1e8] disabled:opacity-30">
                {picker.id ? 'сохранить' : 'положить на доску'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Рассказ голосом */}
      {voice && (
        <div className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-lg rounded-2xl bg-[#f6f1e8] p-4 text-[#2b241c] shadow-2xl ring-1 ring-black/10 sm:bottom-28"
          style={{ animation: 'pop-in 0.35s ease-out both' }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7064]">рассказ ляжет на доску заметкой</p>
            <button type="button" onClick={() => setVoice(false)} aria-label="Закрыть" className="px-2 text-lg">✕</button>
          </div>
          <StoryRecorder onUse={applyStory} hasText={false} />
        </div>
      )}
    </>
  );
}
