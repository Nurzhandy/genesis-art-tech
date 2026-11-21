import { describe, expect, it } from 'vitest';
import { authErrorText, claimable, safeNext, validateAuthForm } from './authShared';

describe('safeNext', () => {
  it('пускает только свои адреса внутри сайта', () => {
    expect(safeNext('/diary/abc/board')).toBe('/diary/abc/board');
    expect(safeNext(undefined)).toBe('/home');
    expect(safeNext('https://evil.example')).toBe('/home');
    expect(safeNext('//evil.example')).toBe('/home');
    expect(safeNext('/\\evil.example')).toBe('/home');
    expect(safeNext('javascript:alert(1)')).toBe('/home');
    expect(safeNext(['/home', '/x'])).toBe('/home');
  });
  it('не зацикливает на страницы входа', () => {
    expect(safeNext('/login?next=/home')).toBe('/home');
    expect(safeNext('/signup')).toBe('/home');
  });
});

describe('authErrorText', () => {
  it('переводит частые ответы Supabase', () => {
    expect(authErrorText('Invalid login credentials')).toBe('Неверная почта или пароль');
    expect(authErrorText('User already registered')).toBe('Такая почта уже есть — войдите');
    expect(authErrorText('Email not confirmed')).toMatch(/не подтверждена/);
    expect(authErrorText('Password should be at least 6 characters.')).toBe('Пароль — не короче 6 знаков');
    expect(authErrorText('Unable to validate email address: invalid format')).toMatch(/Проверьте почту/);
    expect(authErrorText('email rate limit exceeded')).toMatch(/Слишком много попыток/);
    expect(authErrorText('Failed to fetch')).toMatch(/Нет связи/);
    expect(authErrorText('что-то новое')).toBe('Не получилось войти. Попробуйте ещё раз');
  });
});

describe('claimable', () => {
  it('берёт только дневники без владельца и не трогает демо и чужие', () => {
    const rows = [{ id: 'a', owner_id: null }, { id: 'b', owner_id: 'someone-else' }, { id: 'demo', owner_id: null }, { id: 'c', owner_id: null }];
    expect(claimable(rows, 'demo')).toEqual(['a', 'c']);
  });
});

describe('validateAuthForm', () => {
  it('проверяет поля до запроса', () => {
    expect(validateAuthForm({ email: '', password: 'x' }, 'login')).toBe('Введите почту');
    expect(validateAuthForm({ email: 'nope', password: 'x' }, 'login')).toMatch(/Проверьте почту/);
    expect(validateAuthForm({ email: 'a@b.kz', password: '' }, 'login')).toBe('Введите пароль');
    expect(validateAuthForm({ email: 'a@b.kz', password: '123' }, 'signup')).toBe('Пароль — не короче 6 знаков');
    expect(validateAuthForm({ email: 'a@b.kz', password: '123' }, 'login')).toBeNull();
    expect(validateAuthForm({ email: ' a@b.kz ', password: '123456', name: 'Аня' }, 'signup')).toBeNull();
  });
});
