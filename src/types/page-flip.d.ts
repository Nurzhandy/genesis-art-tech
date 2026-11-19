// Минимальные типы для page-flip 2.0.7 (StPageFlip): библиотека не публикует свои .d.ts.
declare module 'page-flip' {
  export interface FlipSetting {
    width: number; height: number;
    size?: 'fixed' | 'stretch';
    minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number;
    startPage?: number;
    drawShadow?: boolean; maxShadowOpacity?: number;
    flippingTime?: number;
    usePortrait?: boolean; autoSize?: boolean; showCover?: boolean;
    mobileScrollSupport?: boolean; clickEventForward?: boolean; useMouseEvents?: boolean;
    swipeDistance?: number; showPageCorners?: boolean; disableFlipByClick?: boolean;
  }
  export interface WidgetEvent<T = unknown> { data: T; object: PageFlip }
  export class PageFlip {
    constructor(block: HTMLElement, setting: FlipSetting);
    loadFromHTML(items: HTMLElement[] | NodeListOf<HTMLElement>): void;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    flip(page: number, corner?: 'top' | 'bottom'): void;
    turnToPage(page: number): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    on(event: 'flip' | 'changeOrientation' | 'changeState' | 'init' | 'update', cb: (e: WidgetEvent) => void): PageFlip;
    destroy(): void;
  }
}
