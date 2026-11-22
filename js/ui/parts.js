// Мелкие общие детали: кнопка «Закрыть», точка записи, показание кольцом, подсказка пустого состояния.
import { reducedMotion } from '../lib/env.js';
import { el, icon, svgEl } from './dom.js';
import { animate } from './motion.js';

/** Круглая кнопка «Закрыть». */
export function closeButton(label, onClick) {
  return el('button', { type: 'button', class: 'btn-icon', 'aria-label': label, onclick: onClick }, icon('x', 18));
}

/**
 * Красная точка идущей записи: пульсирует сама (1,5 с, opacity 1 – 0,4 – 1) и всегда стоит рядом
 * с таймером или словом. Возвращает { el, setAwake(on) }: вне экрана пульс нужно остановить.
 */
export function recDot() {
  const node = el('span', { class: 'rec-dot', 'aria-hidden': 'true' });
  let pulse = null;
  const setAwake = (on) => {
    pulse?.cancel();
    pulse = null;
    if (!on || reducedMotion()) return;
    pulse = animate(node, [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }], 1500, 'ease-in-out', 'none');
    pulse?.effect?.updateTiming({ iterations: Infinity });
  };
  setAwake(true);
  return { el: node, setAwake };
}

const R = 21;
const LENGTH = 2 * Math.PI * R;

/**
 * Уровень 0..1 кольцом вокруг значка (заряд, громкость, ход записи), 48 px. Кольцо заполняется
 * по часовой стрелке сверху и двигается 400 мс, только когда меняется уровень. Число всегда пишется
 * рядом текстом. Возвращает { el, setLevel(k) }.
 */
export function ringGauge(level, iconName = 'glasses') {
  const fill = svgEl('circle', {
    cx: 24, cy: 24, r: R, fill: 'none', stroke: 'var(--moon)', 'stroke-width': 3, 'stroke-linecap': 'round',
    'stroke-dasharray': LENGTH,
  });
  fill.style.transition = 'stroke-dashoffset .4s cubic-bezier(.2, 0, 0, 1)';
  const ring = svgEl('svg', { viewBox: '0 0 48 48', focusable: 'false' },
    svgEl('circle', { cx: 24, cy: 24, r: R, fill: 'none', stroke: 'var(--chip)', 'stroke-width': 3 }), fill);
  Object.assign(ring.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', transform: 'rotate(-90deg)' });
  const node = el('span', { 'aria-hidden': 'true' }, ring, icon(iconName, 20));
  Object.assign(node.style, {
    position: 'relative', display: 'flex', width: '48px', height: '48px', flexShrink: '0',
    alignItems: 'center', justifyContent: 'center', color: 'var(--halo)',
  });
  const setLevel = (value) => {
    const k = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    fill.setAttribute('stroke-dashoffset', LENGTH * (1 - k));
    fill.style.opacity = k > 0 ? '1' : '0';
  };
  setLevel(level);
  return { el: node, setLevel };
}

/** Здесь пока пусто: значок того, что появится, и короткая подсказка. Никогда не выдуманный пример. */
export function emptyHint({ title, text, iconName = 'glasses' }) {
  const body = el('div', { style: { minWidth: '0' } },
    title && el('p', { style: { fontSize: '15px', fontWeight: '600' } }, title),
    el('p', { style: { fontSize: '15px', lineHeight: '1.625', color: 'var(--muted)', marginTop: title ? '2px' : '0' } }, text));
  return el('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '14px' } },
    el('span', { class: 'icon-disc', 'aria-hidden': 'true' }, icon(iconName, 20)), body);
}
