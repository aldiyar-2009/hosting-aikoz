// Распаковка шагами с картинками под теми же шестью лунами: для настройки «меньше движения»
// и для браузеров без 3D. Стили — блок «.story-static» в css/page.css.
import { ru } from '../content/ru.js';
import { scrollToId } from '../lib/env.js';
import { moon } from '../moon/moon.js';
import { STORY_PHASES } from '../moon/phase.js';
import { el, setChildren } from '../ui/dom.js';

const t = ru.story;
/** картинки шагов: img/<имя>.jpg, по одной на сцену */
const STILLS = ['box_01_perspective', 'box_04_top', 'case_perspective', 'kit_in_case_front', 'glasses_perspective', 'glasses_front'];

/** Заголовок и текст сцены; при смене сцены появляется заново (класс animate-rise). */
function caption(index) {
  const s = t.scenes[index];
  return el('div', { class: 'animate-rise' },
    el('h2', { class: 'h2' }, s.title),
    el('p', { class: 'story-static__text' }, s.text));
}

/**
 * «Где я в истории»: шесть лун, от молодого серпа закрытой коробки до полной луны раскрытых очков.
 * Каждая луна — ещё и переход к своей сцене. Возвращает { el, setIndex(i) }.
 */
function phases(onPick) {
  const buttons = t.scenes.map((s, i) => el('button', {
    type: 'button', class: 'story-static__phase', 'aria-label': s.title, onclick: () => onPick(i),
  }, el('span', { class: 'story-static__phase-moon' }, moon({ lit: STORY_PHASES[i], size: 22, glow: false, seas: false }))));
  const list = el('ol', { class: 'story-static__phases', 'aria-label': t.scenesLabel }, buttons.map((b) => el('li', {}, b)));
  const setIndex = (index) => buttons.forEach((b, i) => {
    if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  return { el: list, setIndex };
}

/**
 * Заполнить раздел «Распаковка» шагами с картинками. Возвращает { destroy() }:
 * destroy убирает всё, что здесь добавлено, — после него раздел можно отдать 3D-истории.
 */
export function initStoryStatic(sectionEl) {
  let index = 0;
  const last = t.scenes.length - 1;

  const picture = el('img', { class: 'story-static__picture', width: 1100, height: 800, decoding: 'async' });
  const bigMoon = el('div', { class: 'story-static__moon' });
  const text = el('div', { class: 'story-static__caption', 'aria-live': 'polite' });
  const dots = phases((i) => show(i));
  const prev = el('button', { type: 'button', class: 'btn btn--secondary', onclick: () => show(index - 1) }, t.prev);
  const next = el('button', {
    type: 'button', class: 'btn btn--primary',
    onclick: () => (index < last ? show(index + 1) : scrollToId('explore')),
  });

  // показать сцену: картинка, луна её фазы, подпись, отметка в ряду лун, слова на кнопках
  function show(i) {
    index = Math.min(last, Math.max(0, i));
    picture.src = `img/${STILLS[index]}.jpg`;
    picture.alt = t.scenes[index].title;
    setChildren(bigMoon, moon({ lit: STORY_PHASES[index], size: 132 }));
    setChildren(text, caption(index));
    dots.setIndex(index);
    prev.disabled = index === 0;
    next.textContent = index < last ? t.next : t.skip;
  }

  const root = el('div', { class: 'wrap story-static__grid' },
    picture,
    el('div', {},
      bigMoon,
      text,
      el('div', { class: 'story-static__dots' }, dots.el),
      el('div', { class: 'story-static__buttons' }, prev, next)));

  sectionEl.classList.add('section', 'story-static');
  sectionEl.append(root);
  show(0);

  return {
    destroy() {
      root.remove();
      sectionEl.classList.remove('section', 'story-static');
    },
  };
}
