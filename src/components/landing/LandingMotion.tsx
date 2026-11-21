'use client';
// Движение лендинга на прокрутке (GSAP + ScrollTrigger + SplitText). Разметка остаётся серверной:
// элементы помечаются data-motion, а этот компонент находит их и оживляет.
//   hero   — первый экран уплывает вверх и гаснет, пока человек листает вниз;
//   split  — заголовок поднимается по словам, как строки из-под листа;
//   demo   — картинка-пример выезжает сбоку и выпрямляется (data-side="left|right");
//   paper  — лист с обещаниями «ложится» на стол;
//   finale — финальный вопрос проявляется из размытия.
// При «уменьшить движение» ничего не делаем: всё стоит на своих местах.
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

export function LandingMotion() {
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = <T extends Element = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel);

    q('[data-motion="hero"]').forEach((el) => {
      gsap.to(el, { yPercent: -12, opacity: 0.35, ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true } });
    });

    q('[data-motion="split"]').forEach((el) => {
      const split = SplitText.create(el, { type: 'words', mask: 'words' });
      gsap.from(split.words, {
        yPercent: 110, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
    });

    q('[data-motion="demo"]').forEach((el) => {
      const left = el.dataset.side === 'left';
      gsap.fromTo(el,
        { xPercent: left ? -14 : 14, rotate: left ? -5 : 5, scale: 0.9, opacity: 0 },
        { xPercent: 0, rotate: 0, scale: 1, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 95%', end: 'center 60%', scrub: 0.8 } });
    });

    q('[data-motion="paper"]').forEach((el) => {
      gsap.fromTo(el,
        { y: -140, rotate: -7, opacity: 0, transformOrigin: '50% 0%' },
        { y: 0, rotate: -0.6, opacity: 1, ease: 'back.out(1.4)', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 45%', scrub: 0.9 } });
    });

    q('[data-motion="finale"]').forEach((el) => {
      gsap.fromTo(el,
        { scale: 0.82, filter: 'blur(14px)', opacity: 0 },
        { scale: 1, filter: 'blur(0px)', opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 55%', scrub: 0.8 } });
    });
  });
  return null;
}
