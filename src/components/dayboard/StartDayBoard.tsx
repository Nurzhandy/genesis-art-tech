'use client';
// «Записать день» откуда угодно (архив, книга, пустая страница книги) ведёт на доску дня, а не на форму:
// сразу создаём черновик и открываем его доску. Не вышло (сервер не умеет черновики, дневник только
// для чтения, нет сети) — показываем простую форму, она лежит здесь же запасным путём.
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { localToday } from '@/lib/archive';
import { api } from '@/lib/client/api';

export function StartDayBoard({ diaryId, children }: { diaryId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  // В разработке React запускает эффект дважды — черновик должен создаться один.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.createDraftDay(diaryId, localToday())
      .then(({ dayId }) => router.replace(`/day/${dayId}/board`))
      .catch(() => setFailed(true));
  }, [diaryId, router]);

  if (failed) return <>{children}</>;
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
      <p className="font-hand text-4xl">Раскладываю доску дня…</p>
      <p className="text-lg text-muted">Заметки, фото, песню и настроение можно будет положить как угодно.</p>
    </div>
  );
}
