// Движение, общее для всего сайта: только opacity и transform, через Web Animations API.
import { reducedMotion } from '../lib/env.js';

/** появление: 300 мс */
export const ENTER_MS = 300;
/** скрытие: 200 мс */
export const LEAVE_MS = 200;
export const EASE_ENTER = 'cubic-bezier(.05,.7,.1,1)';
export const EASE_LEAVE = 'cubic-bezier(.3,0,.8,.15)';

export function animate(node, frames, ms, easing = 'linear', fill = 'backwards') {
  if (!node || typeof node.animate !== 'function') return null;
  return node.animate(frames, { duration: ms, easing, fill });
}

/** Панель приходит снизу на `shift` px; с «меньше движения» — только затухание за 150 мс. */
function enterFrames(shift, reduced) {
  return shift > 0 && !reduced
    ? [{ opacity: 0, transform: `translateY(${shift}px)` }, { opacity: 1, transform: 'translateY(0)' }]
    : [{ opacity: 0 }, { opacity: 1 }];
}

/** Проиграть появление элемента (он уже должен стоять в документе). */
export function appear(node, shift = 16, ms = ENTER_MS) {
  const reduced = reducedMotion();
  return animate(node, enterFrames(shift, reduced), reduced ? 150 : ms, EASE_ENTER);
}

/** Проиграть уход элемента и вызвать done(), когда он исчез. Сам элемент не удаляет. */
export function leave(node, done, shift = 8) {
  const reduced = reducedMotion();
  const frames = shift > 0 && !reduced
    ? [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: `translateY(${shift}px)` }]
    : [{ opacity: 1 }, { opacity: 0 }];
  const a = animate(node, frames, reduced ? 150 : LEAVE_MS, EASE_LEAVE, 'forwards');
  if (!a) { done?.(); return null; }
  a.onfinish = () => done?.();
  return a;
}

/**
 * Одно место, меняющееся содержимое. swap.show(id, node): старое уходит (200 мс) поверх нового,
 * новое приходит (300 мс, на `shift` px снизу; shift 0 — простое перетекание, например для вкладок).
 * При первом показе ничего не анимируется. show(null) убирает содержимое. Тот же id — ничего не делает,
 * если не передать `force`.
 *
 * `flow: true` (по умолчанию): содержимое — часть страницы; `host` получает position: relative,
 * уходящее кладётся поверх. `flow: false`: для того, что само себя позиционирует (подпись на 3D-сцене,
 * окно) — класс `itemClass` ставится на каждую обёртку и должен нести позиционирование.
 *
 * onLeave(node) вызывается сразу, как содержимое начало уходить: всё, что оно держит (камера, запись),
 * нужно отпустить в этот момент, а не после затухания.
 */
export function createSwap(host, { flow = true, itemClass = '', shift = 16, enterMs = ENTER_MS, onLeave } = {}) {
  let currentId = null;
  let current = null;
  let first = true;
  if (flow) host.style.position = 'relative';

  function show(id, node, force = false) {
    if (id === currentId && !force) return;
    const old = current;
    if (old) {
      onLeave?.(old.firstChild);
      old.setAttribute('aria-hidden', 'true');
      old.style.pointerEvents = 'none';
      if (flow) Object.assign(old.style, { position: 'absolute', left: '0', right: '0', top: '0' });
      leave(old, () => old.remove(), shift > 0 ? 8 : 0);
    }
    currentId = id;
    current = null;
    if (id === null || !node) return;
    const box = document.createElement('div');
    if (!flow && itemClass) box.className = itemClass;
    box.append(node);
    host.append(box);
    current = box;
    if (!first) appear(box, shift, enterMs);
    first = false;
  }

  return { show, get id() { return currentId; }, get node() { return current?.firstChild ?? null; } };
}

/**
 * Ничего не прыгает: когда один ребёнок колонки вырос или сжался (открылся ответ, карточка сменила
 * список), дети под ним уже стоят на новом месте — они доезжают туда за 300 мс (только transform).
 * Только что добавленного ребёнка не трогает. Возвращает объект: { stop(), enabled }.
 */
export function glide(box) {
  const state = { enabled: true, stop: () => {} };
  if (!box || typeof ResizeObserver === 'undefined') return state;
  const tops = new WeakMap();
  let width = box.offsetWidth;
  const measure = () => {
    // новая ширина — новая вёрстка (окно изменили, телефон повернули): тогда ничего не едет
    const resized = box.offsetWidth !== width;
    width = box.offsetWidth;
    for (const child of Array.from(box.children)) {
      // offsetTop не учитывает transform, так что идущий сдвиг не портит замер
      const top = child.offsetTop - box.offsetTop;
      const was = tops.get(child);
      tops.set(child, top);
      // transform сдвинул бы открытое окно (position: fixed) вместе с панелью
      if (was === undefined || resized || Math.abs(was - top) < 2 || child.querySelector('[role=dialog]')) continue;
      if (!state.enabled || reducedMotion()) continue;
      animate(child, [{ transform: `translateY(${was - top}px)` }, { transform: 'translateY(0)' }], ENTER_MS, EASE_ENTER, 'none');
    }
  };
  measure();
  const sizes = new ResizeObserver(measure);
  const watch = () => {
    sizes.disconnect();
    sizes.observe(box);
    for (const child of Array.from(box.children)) sizes.observe(child);
  };
  watch();
  const kids = new MutationObserver(watch);
  kids.observe(box, { childList: true });
  state.stop = () => { sizes.disconnect(); kids.disconnect(); };
  return state;
}
