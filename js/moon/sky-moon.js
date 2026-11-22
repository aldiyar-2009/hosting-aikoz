// Большая луна за 3D-сценами. Фаза может идти за прокруткой: setLit меняет только transform и opacity
// слоёв, нарисованных один раз (стили — «.sky-moon» в css/base.css).
import { watchOnScreen } from '../lib/env.js';
import { el } from '../ui/dom.js';
import { clampLit, haloFor, terminator } from './phase.js';

/** уже этого освещённая «выпуклость» не рисуется: её снимок пришлось бы растягивать слишком сильно */
const BULGE_MIN = 0.02;

/**
 * Та же геометрия, что у неподвижной луны (moon.js), но в виде transform и opacity готовых слоёв.
 * Диск — снимок полной Луны. Поверх лежит ночь: левая половина всегда, а до первой четверти — ещё тёмный
 * эллипс («shade») посередине. После первой четверти влево растёт светлый эллипс («bulge»): тот же
 * снимок в сжатой рамке, растянутый внутри обратно, так что лицо Луны стоит на месте.
 */
function layers(lit) {
  const k = clampLit(lit);
  const t = terminator(k);
  const shadeOn = t.side === 'shade' && t.sx > 0.004;
  const bulgeOn = t.side === 'bulge' && t.sx > BULGE_MIN;
  const bx = bulgeOn ? t.sx : BULGE_MIN;
  return {
    shade: { opacity: shadeOn ? 1 : 0, transform: `scale(${shadeOn ? t.sx.toFixed(4) : 0}, ${t.sy.toFixed(4)})` },
    bulge: { opacity: bulgeOn ? 1 : 0, transform: `scale(${bx.toFixed(4)}, ${t.sy.toFixed(4)})` },
    bulgeFace: { transform: `scale(${(1 / bx).toFixed(4)}, ${(1 / t.sy).toFixed(4)})` },
    halo: { opacity: Number(haloFor(k).toFixed(3)) },
  };
}

/**
 * Создать луну. Размер и место задаёт класс `className`: диск — квадрат по ширине блока.
 * Возвращает { el, setLit(k), setPaused(paused) }:
 *   setLit — фаза (0 новолуние, 1 полнолуние); можно звать каждый кадр;
 *   setPaused(true) — остановить «дыхание» ореола (вне экрана оно останавливается и само).
 */
export function createSkyMoon({ lit = 1, className = '' } = {}) {
  const halo = el('div', { class: 'sky-moon-halo' });
  const shade = el('div', { class: 'sky-moon-shade' });
  const bulgeFace = el('div', { class: 'sky-moon-face' });
  const bulge = el('div', { class: 'sky-moon-bulge' }, bulgeFace);
  const box = el('div', { class: `sky-moon ${className}`.trim(), 'aria-hidden': 'true' },
    el('div', { class: 'sky-moon-breath' }, halo),
    el('div', { class: 'sky-moon-disc' },
      el('div', { class: 'sky-moon-left' }),
      shade,
      bulge,
      el('div', { class: 'sky-moon-earthshine' }),
      el('div', { class: 'sky-moon-limb' })));

  // переложить фазу в слои
  const put = (node, style) => {
    if (style.opacity !== undefined) node.style.opacity = String(style.opacity);
    if (style.transform !== undefined) node.style.transform = style.transform;
  };
  let shown = null;
  function setLit(next) {
    if (next === shown) return;
    shown = next;
    const l = layers(next);
    put(shade, l.shade);
    put(bulge, l.bulge);
    put(bulgeFace, l.bulgeFace);
    put(halo, l.halo);
  }
  setLit(lit);

  // «дыхание» ореола отдыхает, пока луна вне экрана или её остановили снаружи
  let onScreen = false;
  let paused = false;
  const sync = () => box.classList.toggle('is-paused', paused || !onScreen);
  sync();
  watchOnScreen(box, (on) => { onScreen = on; sync(); }, '0px');
  const setPaused = (value) => { paused = !!value; sync(); };

  return { el: box, setLit, setPaused };
}
