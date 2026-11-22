// Что умеет браузер и что сейчас на экране.

/** Может ли браузер рисовать 3D. */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const reducedQuery = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Включена ли в системе настройка «меньше движения». */
export const reducedMotion = () => !!reducedQuery && reducedQuery.matches;

/** Сообщить, когда настройку «меньше движения» переключили. Возвращает функцию отписки. */
export function onReducedMotionChange(run) {
  if (!reducedQuery) return () => {};
  const on = () => run(reducedQuery.matches);
  reducedQuery.addEventListener('change', on);
  return () => reducedQuery.removeEventListener('change', on);
}

/**
 * Следит, на экране ли элемент: run(true / false). С запасом `margin` вокруг окна.
 * Нужно, чтобы 3D и бесконечные анимации отдыхали вне экрана. Возвращает функцию отписки.
 */
export function watchOnScreen(el, run, margin = '200px') {
  const io = new IntersectionObserver(([e]) => run(e.isIntersecting), { rootMargin: margin });
  io.observe(el);
  return () => io.disconnect();
}

/** Плавно прокрутить страницу к разделу с этим id. */
export const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
