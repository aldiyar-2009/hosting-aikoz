// Шапка сайта (фон после прокрутки, меню на телефоне) и окно «Инструкция».
// Разметка шапки записана в index.html, стили — в css/page.css.
import { ru } from '../content/ru.js';
import { tidy } from '../content/typo.js';
import { reducedMotion, scrollToId } from '../lib/env.js';
import { trapDialog } from '../ui/dialog.js';
import { el } from '../ui/dom.js';
import { closeButton } from '../ui/parts.js';

/** Включить поведение шапки. */
export function initHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const menu = header.querySelector('#site-menu');
  const toggle = header.querySelector('[data-menu-toggle]');
  const iconOpen = toggle?.querySelector('[data-icon="menu"]');
  const iconClose = toggle?.querySelector('[data-icon="x"]');
  let open = false;
  let solid = false;

  // ночь закрывается за шапкой, когда страница сдвинулась на 24 px или открыто меню; меняется только opacity
  const paint = () => header.classList.toggle('is-solid', solid || open);
  const onScroll = () => { solid = window.scrollY > 24; paint(); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // меню на телефоне: открыть и закрыть
  const setOpen = (value) => {
    open = value;
    if (menu) menu.hidden = !open;
    toggle?.setAttribute('aria-expanded', String(open));
    iconOpen?.toggleAttribute('hidden', open);
    iconClose?.toggleAttribute('hidden', !open);
    paint();
  };
  toggle?.addEventListener('click', () => setOpen(!open));
  window.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') setOpen(false); });

  // ссылки меню: закрыть меню и прокрутить к разделу
  for (const link of header.querySelectorAll('[data-nav]')) {
    link.addEventListener('click', () => { setOpen(false); scrollToId(link.dataset.nav); });
  }
  // знак в шапке возвращает в начало страницы
  header.querySelector('[data-top]')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
}

let manualOpen = false;

/** Открыть окно «Инструкция»: русский раздел инструкции обычным текстом (тексты — ru.manual). */
export function openManual() {
  if (manualOpen) return;
  manualOpen = true;
  const m = ru.manual;
  let release = () => {};
  const close = () => {
    if (!manualOpen) return;
    manualOpen = false;
    overlay.remove();
    release();
  };

  const box = el('div', { class: 'manual animate-rise', onclick: (e) => e.stopPropagation() },
    el('div', { class: 'manual__head' },
      el('div', {},
        el('h2', { class: 'manual__title' }, m.title),
        el('p', { class: 'manual__note' }, tidy(m.note))),
      closeButton(ru.explore.close, close)),
    el('div', { class: 'manual__grid' },
      m.sections.map((s) => el('section', { class: 'manual__section' },
        el('h3', { class: 'h3' }, s.title),
        el('ul', { class: 'manual__lines' },
          s.lines.map((l) => el('li', {}, el('span', { class: 'manual__dot', 'aria-hidden': 'true' }), tidy(l))))))));
  // щелчок по затемнению вокруг окна закрывает его
  const overlay = el('div', {
    class: 'manual-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': m.title, onclick: close,
  }, box);

  document.body.append(overlay);
  // клавиатура: фокус внутрь, Tab по кругу, Escape закрывает, после закрытия фокус возвращается на кнопку
  release = trapDialog(box, close);
}
