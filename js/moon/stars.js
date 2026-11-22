// Редкое тихое звёздное небо за разделом: ночь над степью, а не космос.
// Почти все звёзды — одна неподвижная картинка SVG. Немногие «дышат»: это отдельные точки, у каждой
// свой период 3–7 с; меняется только прозрачность (на 0,2 своего света, никогда до нуля).
import { watchOnScreen } from '../lib/env.js';
import { el, svgEl } from '../ui/dom.js';

/** Маленький генератор случайных чисел: одно и то же зерно всегда даёт одно и то же небо. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** доля мерцающих звёзд (10–15 %) */
const TWINKLE_SHARE = 0.13;

/**
 * Создать небо: count — сколько звёзд, seed — зерно.
 * Возвращает { el, setPaused(paused) }. Блок `el` занимает всего родителя (position: absolute; inset: 0),
 * родителю нужен position: relative. Вне экрана мерцание останавливается само.
 * На телефоне каждая вторая звезда спрятана (класс .star-sparse в css/page.css): экран втрое меньше.
 */
export function createStars({ count = 70, seed = 7 } = {}) {
  const next = rng(seed);
  const still = svgEl('svg', { focusable: 'false' });
  Object.assign(still.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  const box = el('div', { class: 'stars', 'aria-hidden': 'true' }, still);
  Object.assign(box.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });

  for (let i = 0; i < count; i++) {
    const s = {
      x: next() * 100, y: next() * 100, size: 1 + next() * 1.8, o: 0.3 + next() * 0.5,
      period: 3 + next() * 4, delay: next() * 7,
    };
    const sparse = i % 2 ? 'star-sparse' : '';
    if (next() < TWINKLE_SHARE) {
      // мерцающая звезда: свой свет — в цвете, анимация только забирает его часть и возвращает
      const star = el('span', { class: `star ${sparse}`.trim() });
      Object.assign(star.style, {
        left: `${s.x}%`, top: `${s.y}%`, width: `${s.size + 0.6}px`, height: `${s.size + 0.6}px`,
        backgroundColor: `rgba(241, 239, 230, ${(s.o + 0.2).toFixed(2)})`,
        animationDuration: `${(s.period / 2).toFixed(2)}s`, animationDelay: `-${s.delay.toFixed(2)}s`,
      });
      box.append(star);
    } else {
      still.append(svgEl('circle', {
        cx: `${s.x}%`, cy: `${s.y}%`, r: s.size / 2, fill: '#F1EFE6', 'fill-opacity': s.o, class: sparse || null,
      }));
    }
  }

  // мерцание отдыхает, пока небо вне экрана или его остановили снаружи
  let onScreen = false;
  let paused = false;
  const sync = () => box.classList.toggle('is-paused', paused || !onScreen);
  sync();
  watchOnScreen(box, (on) => { onScreen = on; sync(); }, '0px');
  const setPaused = (value) => { paused = !!value; sync(); };

  return { el: box, setPaused };
}
