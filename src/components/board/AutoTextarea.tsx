'use client';
// Поле, которое растёт вместе с текстом: без ползунка, заметка просто становится выше.
import { useLayoutEffect, useRef } from 'react';

export function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';               // сначала сжать, чтобы поле умело и уменьшаться
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea {...props} ref={ref} rows={props.rows ?? 1} style={{ ...props.style, overflow: 'hidden' }} />;
}
