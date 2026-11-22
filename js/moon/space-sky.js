// Космос за всей страницей: тёмное небо с туманностями («.space-sky» в css/base.css) и неподвижное
// поле звёзд. Один слой на страницу; звёзды рисуются один раз и заново — только когда меняется ширина окна.
import { el } from '../ui/dom.js';

/** Маленький генератор случайных чисел: одно и то же зерно всегда даёт одно и то же небо. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** цвета звёзд: большинство — лунный белый, часть голубоватые, немного тёплых */
const TINTS = ['241,239,230', '241,239,230', '241,239,230', '241,239,230', '241,239,230', '241,239,230', '241,239,230', '200,214,255', '200,214,255', '255,226,190'];

/**
 * Нарисовать звёзды: тысячи тусклых точек, полоса Млечного пути и несколько ярких звёзд с ореолом.
 * Здесь ничего не движется, поэтому после этого вызова небо ничего не стоит.
 */
function paint(canvas) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const next = rng(20261118);
  const area = w * h;

  const dot = (x, y, r, a, tint) => {
    g.fillStyle = `rgba(${tint},${a.toFixed(3)})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };

  // поле: почти все звёзды тусклые (куб случайного числа), немногие ясные
  const field = Math.round(area / 1500);
  for (let i = 0; i < field; i++) {
    const b = next() ** 3;
    dot(next() * w, next() * h, 0.35 + b * 0.9, 0.16 + b * 0.62, TINTS[Math.floor(next() * TINTS.length)]);
  }

  // Млечный путь: полоса очень тусклой пыли из левого нижнего угла в правый верхний
  const band = Math.round(area / 900);
  const len = Math.hypot(w, h);
  const ang = Math.atan2(-h * 0.55, w);
  for (let i = 0; i < band; i++) {
    const along = (next() - 0.5) * len * 1.2;
    // сумма трёх случайных чисел: густо в середине полосы, редко по краям
    const across = (next() + next() + next() - 1.5) * Math.min(w, h) * 0.22;
    const x = w / 2 + Math.cos(ang) * along - Math.sin(ang) * across;
    const y = h * 0.52 + Math.sin(ang) * along + Math.cos(ang) * across;
    if (x < 0 || y < 0 || x > w || y > h) { next(); continue; }
    dot(x, y, 0.3 + next() * 0.45, 0.07 + next() * 0.16, TINTS[Math.floor(next() * TINTS.length)]);
  }

  // несколько ярких звёзд с мягким ореолом (готовый градиент, без размытия)
  const bright = Math.max(6, Math.round(area / 110000));
  for (let i = 0; i < bright; i++) {
    const x = next() * w;
    const y = next() * h;
    const r = 1 + next() * 0.7;
    const tint = TINTS[Math.floor(next() * TINTS.length)];
    const glow = g.createRadialGradient(x, y, 0, x, y, r * 6);
    glow.addColorStop(0, `rgba(${tint},.3)`);
    glow.addColorStop(1, `rgba(${tint},0)`);
    g.fillStyle = glow;
    g.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    dot(x, y, r, 0.92, tint);
  }
}

/**
 * Поставить космос под страницу. Слой «.space-sky» уже записан в index.html (так фон виден до загрузки
 * скриптов); если его нет — слой создаётся здесь. Разделы страницы прозрачные, небо видно сквозь все.
 */
export function mountSpaceSky() {
  let layer = document.querySelector('.space-sky');
  if (!layer) {
    layer = el('div', { class: 'space-sky', 'aria-hidden': 'true' });
    document.body.prepend(layer);
  }
  let canvas = layer.querySelector('canvas');
  if (!canvas) {
    canvas = el('canvas', { class: 'space-sky-stars' });
    layer.append(canvas);
  }
  paint(canvas);

  let timer;
  let width = window.innerWidth;
  window.addEventListener('resize', () => {
    // телефон прячет и показывает адресную строку при прокрутке: меняется только высота — небо остаётся
    if (window.innerWidth === width && Math.abs(window.innerHeight - canvas.height / Math.min(window.devicePixelRatio || 1, 2)) < 160) return;
    width = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(() => paint(canvas), 200);
  });
  return layer;
}
