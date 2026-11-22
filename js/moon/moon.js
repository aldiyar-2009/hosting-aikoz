// Неподвижная луна Aikoz (SVG): настоящее лицо Луны с мягкой границей света и тени.
// Для луны, фаза которой идёт за прокруткой, есть sky-moon.js — он меняет фазу без перерисовки.
import { svgEl } from '../ui/dom.js';
import { clampLit, haloFor, terminator } from './phase.js';

/** снимок полного диска Луны (карта NASA LROC); путь — от index.html */
const MOON_FACE = 'img/moon-face-512.webp';

/** цвета луны: единственное место, где они записаны числами (см. «Токены» в css/base.css) */
const MOON = {
  lit: '#F1EFE6', // освещённая сторона маленькой луны без снимка
  rim: '#6E79B3', // контур диска
  dark: '#0B1033', // тёмная сторона
  halo: '#BFC9FF',
  night: '#050818',
};
/** насколько лицо Луны видно на тёмной стороне (пепельный свет) */
const EARTHSHINE = 0.1;
/** радиус диска в поле 200 × 200 */
const R = 70;

// у каждой луны на странице свои id градиентов и масок
let count = 0;

/**
 * Нарисовать луну.
 *   lit  — освещённая доля: 0 новолуние, 0.5 первая четверть, 1 полнолуние;
 *   size — сторона квадрата: число (px) или строка CSS; по умолчанию — вся ширина блока;
 *   glow — ореол вокруг диска; без него диск занимает весь квадрат;
 *   seas — лицо Луны на диске; для лун мельче ~32 px выключать.
 * Луна — украшение: для программ чтения с экрана она скрыта.
 */
export function moon({ lit, size = '100%', glow = true, seas = true, className = '' } = {}) {
  const id = `moon${++count}`;
  const k = clampLit(lit);
  const t = terminator(k);
  const shade = t.side === 'shade';
  const softColor = shade ? '#000' : '#fff';
  const face = (opacity) => svgEl('image', {
    href: MOON_FACE, x: 30, y: 30, width: 140, height: 140, preserveAspectRatio: 'none', opacity,
  });
  const stop = (offset, color, opacity) => svgEl('stop', { offset, 'stop-color': color, 'stop-opacity': opacity });

  const defs = svgEl('defs', {},
    svgEl('radialGradient', { id: `${id}-halo` },
      stop('68%', MOON.halo, 0.26 * haloFor(k)),
      stop('80%', MOON.halo, 0.08 * haloFor(k)),
      stop('100%', MOON.halo, 0)),
    // эллипс границы света и тени: плотный внутри, тает к краю
    svgEl('radialGradient', { id: `${id}-soft` },
      stop('84%', softColor),
      stop('100%', softColor, 0)),
    svgEl('linearGradient', { id: `${id}-edge` },
      stop('0%', '#fff', 0),
      stop('9%', '#fff')),
    svgEl('mask', { id: `${id}-lit`, maskUnits: 'userSpaceOnUse', x: 30, y: 30, width: 140, height: 140 },
      k > 0 && svgEl('rect', { x: 95.8, y: 30, width: 74.2, height: 140, fill: `url(#${id}-edge)` }),
      t.sx > 0.004 && svgEl('ellipse', { cx: 100, cy: 100, rx: R * t.sx, ry: R * t.sy, fill: `url(#${id}-soft)` })),
    svgEl('clipPath', { id: `${id}-disc` }, svgEl('circle', { cx: 100, cy: 100, r: R })),
    // край диска темнее: диск читается шаром
    seas && svgEl('radialGradient', { id: `${id}-limb` },
      stop('55%', MOON.night, 0),
      stop('86%', MOON.night, 0.07),
      stop('100%', MOON.night, 0.22)));

  const disc = svgEl('g', { 'clip-path': `url(#${id}-disc)` },
    svgEl('rect', { x: 30, y: 30, width: 140, height: 140, fill: MOON.dark }),
    seas && face(EARTHSHINE),
    svgEl('g', { mask: `url(#${id}-lit)` },
      // лунный свет под снимком: диск светится, пока снимок не загрузился, и на маленьких лунах
      svgEl('rect', { x: 30, y: 30, width: 140, height: 140, fill: MOON.lit }),
      seas && face()),
    seas && svgEl('circle', { cx: 100, cy: 100, r: 70, fill: `url(#${id}-limb)` }));

  return svgEl('svg', {
    viewBox: glow ? '0 0 200 200' : '29 29 142 142',
    width: size,
    height: size,
    class: className || null,
    'aria-hidden': 'true',
    focusable: 'false',
  },
    defs,
    glow && svgEl('circle', { cx: 100, cy: 100, r: 100, fill: `url(#${id}-halo)` }),
    disc,
    svgEl('circle', {
      cx: 100, cy: 100, r: R - 0.5, fill: 'none', stroke: MOON.rim, 'stroke-opacity': seas ? 0.45 : 1,
      'stroke-width': 1, 'vector-effect': 'non-scaling-stroke',
    }));
}
