'use client';
// Регистрация и вход (план 21.11, часть A): лист дневника с почтой и паролем, в духе бумаги, а не «корпоративной» формы.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { validateAuthForm } from '@/lib/authShared';
import { AUTH_ROUTES, signIn, signUp, useAuth } from '@/lib/client/auth';
import { useAuthAvailable } from '@/lib/client/supabase';

type Mode = 'signup' | 'login';

const COPY: Record<Mode, { kicker: string; title: string; hand: string; submit: string; busy: string; switchText: string; switchLink: string }> = {
  signup: { kicker: 'регистрация', title: 'Заведите свой дневник', hand: 'каждый день — страница', submit: 'Создать аккаунт', busy: 'создаю…', switchText: 'Уже есть аккаунт?', switchLink: 'Войти' },
  login: { kicker: 'вход', title: 'С возвращением', hand: 'дневник ждал вас', submit: 'Войти', busy: 'вхожу…', switchText: 'Ещё нет аккаунта?', switchLink: 'Зарегистрироваться' },
};

const field = 'w-full border-b border-foreground/25 bg-transparent py-2 text-2xl outline-none transition-colors placeholder:text-muted/50 focus:border-foreground';
const label = 'font-mono text-[11px] uppercase tracking-[0.2em] text-muted';

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; kind: 'error' | 'info' } | null>(null);
  const c = COPY[mode];
  const offline = !useAuthAvailable();

  // Уже вошли — сразу дальше.
  useEffect(() => { if (!loading && user) router.replace(next); }, [loading, user, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const bad = validateAuthForm({ email, password, name }, mode);
    if (bad) { setMsg({ text: bad, kind: 'error' }); return; }
    setBusy(true); setMsg(null);
    try {
      if (mode === 'signup') await signUp(email, password, name); else await signIn(email, password);
      router.replace(next);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Не получилось войти. Попробуйте ещё раз';
      setMsg({ text, kind: text.startsWith('Мы отправили письмо') ? 'info' : 'error' });
      setBusy(false);
    }
  }

  const other = mode === 'signup' ? AUTH_ROUTES.login : AUTH_ROUTES.signup;
  const otherHref = next === AUTH_ROUTES.home ? other : `${other}?next=${encodeURIComponent(next)}`;

  return (
    <main className="relative mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 sm:py-16 md:grid-cols-[1fr_minmax(0,440px)]">
      {/* Левая половина: сложенные листы дневника — только на широком экране */}
      <div className="relative hidden h-[420px] md:block" aria-hidden style={{ animation: 'pop-in 0.8s ease-out both' }}>
        <div className="absolute left-[8%] top-[10%] h-[300px] w-[230px] rotate-[-7deg] rounded-sm bg-[#e9dcc4] shadow-xl" />
        <div className="absolute left-[22%] top-[4%] h-[310px] w-[240px] rotate-[4deg] rounded-sm bg-[#f7f1e6] p-6 shadow-2xl">
          <span className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-[-3deg] bg-[#e8d9a8]/90" />
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#7a7064]">21.11 · день 001</p>
          <p className="mt-4 font-hand text-3xl leading-tight text-[#2b241c]">{c.hand}</p>
          <div className="mt-6 space-y-3">
            {[90, 75, 82, 60].map((w, i) => <span key={i} className="block h-[2px] rounded bg-[#2b241c]/15" style={{ width: `${w}%` }} />)}
          </div>
          <span className="absolute bottom-6 right-6 h-14 w-14 rounded-[58%_42%_55%_45%/52%_60%_40%_48%]" style={{ background: 'conic-gradient(#f6c445, #e8574a, #5b7fd1, #5cb88a, #f6c445)' }} />
        </div>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-6" style={{ animation: 'pop-in 0.6s ease-out 0.1s both' }}>
        <div>
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted hover:text-foreground">← Дневник атмосферы</Link>
          <p className={`${label} mt-8`}>{c.kicker}</p>
          <h1 className="mt-1 text-5xl font-semibold leading-[1.05]">{c.title}</h1>
        </div>

        {offline && (
          <p className="rounded-md border border-foreground/15 px-4 py-3 text-base text-muted">
            На этом компьютере не подключены ключи Supabase, поэтому входа нет. Дневники работают на этом устройстве без аккаунта — <Link href={AUTH_ROUTES.home} className="underline underline-offset-4">перейти к столу</Link>.
          </p>
        )}

        {mode === 'signup' && (
          <label className="flex flex-col gap-1">
            <span className={label}>как вас зовут</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" placeholder="Аня" className={field} />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className={label}>почта</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required placeholder="you@mail.kz" className={field} autoFocus={mode === 'login'} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>пароль{mode === 'signup' ? ' · от 6 знаков' : ''}</span>
          <span className="relative flex items-center">
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'signup' ? 6 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className={`${field} pr-20`} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}
              className="absolute right-0 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-foreground">{show ? 'скрыть' : 'показать'}</button>
          </span>
        </label>

        <p aria-live="polite" className={`min-h-[1.5rem] text-base ${msg?.kind === 'error' ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>{msg?.text}</p>

        <button type="submit" disabled={busy || offline} data-magnetic
          className="rounded-full bg-foreground px-8 py-3.5 font-mono text-sm uppercase tracking-[0.15em] text-background transition hover:opacity-90 disabled:opacity-50">
          {busy ? c.busy : c.submit}
        </button>
        <p className="text-center text-lg text-muted">
          {c.switchText} <Link href={otherHref} className="text-foreground underline underline-offset-4">{c.switchLink}</Link>
        </p>
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
          <Link href="/diary/demo" className="hover:text-foreground">или сначала посмотреть демо-дневник →</Link>
        </p>
      </form>
    </main>
  );
}
