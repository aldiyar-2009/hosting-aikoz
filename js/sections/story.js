// История распаковки: 3D-сцена приколота к экрану, прокрутка ведёт историю вперёд и назад,
// луна за сценой растёт вместе с ней. Луну и звёзды двигает цикл кадров 3D-сцены (один цикл на всю
// сцену) и только через transform и opacity. Сцена рисуется, лишь пока история движется.
//
// initStory(sectionEl, { onReady }) → { destroy() }
//   sectionEl — пустой <section id="story">; всё содержимое строится здесь;
//   onReady   — 3D-модели готовы и показаны.
// Вызывать только там, где есть WebGL и не включено «меньше движения» (иначе — история шагами с картинками).

import { ru } from '../content/ru.js';
import { reducedMotion, scrollToId, watchOnScreen } from '../lib/env.js';
import { moon } from '../moon/moon.js';
import { litForProgress, STORY_PHASES } from '../moon/phase.js';
import { createSkyMoon } from '../moon/sky-moon.js';
import { createStars } from '../moon/stars.js';
import { createStoryCanvas } from '../scene/story-canvas.js';
import { sceneIndexAt, SCENES } from '../scene/timeline.js';
import { el, icon } from '../ui/dom.js';

const t = ru.story;
/** на сколько звёзды смещаются за всю историю, px (параллакс не сильнее 20 px) */
const STAR_DRIFT = 20;
/** высота раздела на одну сцену, в высотах экрана */
const VH_PER_SCENE = 95;

/** Подпись сцены: заголовок и строка текста; появляется с подъёмом (.animate-rise). */
function caption(index) {
  const s = t.scenes[index];
  return el('div', { class: 'animate-rise' },
    el('h2', { class: 'h2', text: s.title }),
    el('p', { class: 'story-text', text: s.text }),
  );
}

export function initStory(sectionEl, { onReady } = {}) {
  let progress = 0;
  /** ход истории, для которого небо уже нарисовано */
  let shown = -1;
  let index = -1;
  let ready = false;
  let dead = false;

  // ---- разметка ----
  const stars = createStars({ count: 52, seed: 7 });
  const sky = el('div', { class: 'story-sky' }, stars.el);
  const skyMoon = createSkyMoon({ lit: STORY_PHASES[0], className: 'story-moon' });
  const holder = el('div', { class: 'story-canvas' });
  // под диском луны, а не на нём
  const loading = el('p', { class: 'story-under-moon story-loading caption', role: 'status', text: ru.explore.loading });

  const captionBox = el('div', { class: 'story-caption' });
  // «где я в истории»: шесть лун, от молодого серпа закрытой коробки до полнолуния раскрытых очков;
  // каждая — ещё и переход к своей сцене
  const phaseButtons = t.scenes.map((s, i) => el('button', {
    type: 'button', class: 'story-phase', 'aria-label': s.title, onclick: () => goTo(i),
  }, el('span', { class: 'story-phase-moon' }, moon({ lit: STORY_PHASES[i], size: 22, glow: false, seas: false }))));
  const phases = el('ol', { class: 'story-phases', 'aria-label': t.scenesLabel }, phaseButtons.map((b) => el('li', {}, b)));
  // на телефоне хватает места шести лунам и круглой кнопке; слова появляются на экране пошире
  const skipIcon = el('button', { type: 'button', class: 'btn-icon story-skip-icon', 'aria-label': t.skip, onclick: skip }, icon('skip-forward', 17));
  const skipWide = el('button', { type: 'button', class: 'btn btn--secondary story-skip-wide', onclick: skip }, icon('skip-forward', 16), ` ${t.skip}`);
  const bottom = el('div', { class: 'story-shade story-bottom' },
    el('div', { class: 'wrap' },
      captionBox,
      el('div', { class: 'story-controls' }, phases, skipIcon, skipWide),
    ),
  );
  // подсказка «Листайте вниз» — только на первой сцене
  const hint = el('p', { class: 'story-hint caption' },
    el('span', { class: 'story-hint-pill' }, `${t.hint} `, icon('chevron-down', 14)),
  );
  const stage = el('div', { class: 'story-stage' }, sky, skyMoon.el, holder, loading, bottom, hint);

  sectionEl.classList.add('story');
  sectionEl.style.height = `${SCENES.length * VH_PER_SCENE}vh`;
  sectionEl.replaceChildren(stage);

  // ---- небо: фаза луны и смещение звёзд ----
  /** Поставить небо туда, где сейчас история. Зовёт цикл кадров 3D; пока 3D не готово — прокрутка. */
  function paint(p) {
    if (p === shown) return;
    shown = p;
    skyMoon.setLit(litForProgress(p));
    sky.style.transform = `translate3d(0, ${(-STAR_DRIFT * p).toFixed(1)}px, 0)`;
  }

  // ---- сцена: подпись, шесть лун, подсказка ----
  function setIndex(next) {
    if (next === index) return;
    index = next;
    captionBox.replaceChildren(caption(index));
    phaseButtons.forEach((b, i) => {
      b.classList.toggle('is-on', i === index);
      if (i === index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    hint.hidden = index !== 0;
  }

  // ---- 3D ----
  const canvas = createStoryCanvas(holder, {
    getProgress: () => progress,
    onFrame: paint,
    onReady: () => {
      if (dead) return;
      ready = true;
      holder.classList.add('is-ready');
      loading.remove();
      onReady?.();
    },
  });

  // ---- прокрутка ----
  function update() {
    const rect = sectionEl.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
    setIndex(sceneIndexAt(progress));
    if (ready) canvas.wake(); else paint(progress);
  }
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  /** Плавно прокрутить к готовой картинке сцены. */
  function goTo(scene) {
    const top = sectionEl.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + (sectionEl.offsetHeight - window.innerHeight) * SCENES[scene].rest,
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  }
  function skip() { scrollToId('explore'); }

  // ---- вне экрана 3D не рисуется (ореол луны и звёзды останавливают себя сами) ----
  const unwatch = watchOnScreen(sectionEl, (on) => canvas.setActive(on));

  return {
    destroy() {
      if (dead) return;
      dead = true;
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      unwatch();
      skyMoon.setPaused(true);
      stars.setPaused(true);
      canvas.destroy();
      sectionEl.replaceChildren();
      sectionEl.style.height = '';
      sectionEl.classList.remove('story');
    },
  };
}
