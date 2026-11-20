// Переход между страницами как перелистывание (ресерч 20.11, M7): View Transitions из React 19.3 / Next 16.
// Обёртка ставится в page.tsx, а не в layout: layout не меняется при навигации, и анимация не сработала бы.
import { ViewTransition } from 'react';

export function PageFade({ children }: { children: React.ReactNode }) {
  return <ViewTransition enter="page" exit="page" default="none">{children}</ViewTransition>;
}
