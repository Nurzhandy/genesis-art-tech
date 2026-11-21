// Вход и аккаунты (план 21.11, часть A): чистые функции, общие для браузера и сервера. Без запросов — легко тестировать.

/** Куда вернуть после входа: только свой адрес внутри сайта (не «//чужой.сайт», не javascript:). */
export function safeNext(next: string | string[] | undefined | null, fallback = '/home'): string {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.length > 300) return fallback;
  if (v.startsWith('/login') || v.startsWith('/signup')) return fallback;
  return v;
}

/** Ответ Supabase Auth → понятный русский текст. */
export function authErrorText(raw: string | undefined | null): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Неверная почта или пароль';
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists')) return 'Такая почта уже есть — войдите';
  if (m.includes('email not confirmed')) return 'Почта не подтверждена: откройте письмо от нас и нажмите ссылку';
  if (m.includes('password') && (m.includes('at least') || m.includes('short') || m.includes('6'))) return 'Пароль — не короче 6 знаков';
  if (m.includes('weak') && m.includes('password')) return 'Пароль слишком простой — добавьте цифры или буквы';
  if (m.includes('invalid') && m.includes('email') || m.includes('unable to validate email')) return 'Проверьте почту — адрес выглядит неверно';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Слишком много попыток — подождите минуту и попробуйте снова';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Регистрация сейчас выключена';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'Нет связи с сервером — проверьте интернет';
  return 'Не получилось войти. Попробуйте ещё раз';
}

/** Какие дневники с полки устройства можно привязать к аккаунту: только без владельца (чужие не трогаем). */
export function claimable(rows: { id: string; owner_id: string | null }[], demoId: string): string[] {
  return rows.filter((r) => r.owner_id == null && r.id !== demoId).map((r) => r.id);
}

/** Проверка формы до запроса: пустые поля, похожая на правду почта, длина пароля. null — всё хорошо. */
export function validateAuthForm(v: { email: string; password: string; name?: string }, mode: 'signup' | 'login'): string | null {
  if (!v.email.trim()) return 'Введите почту';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return 'Проверьте почту — адрес выглядит неверно';
  if (!v.password) return 'Введите пароль';
  if (mode === 'signup' && v.password.length < 6) return 'Пароль — не короче 6 знаков';
  if (mode === 'signup' && (v.name ?? '').trim().length > 60) return 'Имя слишком длинное';
  return null;
}
