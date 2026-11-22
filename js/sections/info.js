// Разделы «Подписка» (выбор плана и заявка в WhatsApp) и «Вопросы и ответы» (открыт один ответ).
// Разметка записана в index.html, стили — в css/page.css.
import { contacts, whatsappHref } from '../content/contacts.js';
import { ru } from '../content/ru.js';
import { scrollToId } from '../lib/env.js';
import { glide } from '../ui/motion.js';

/**
 * Подписка: онлайн-оплаты и цены пока нет, поэтому заявка честная — кнопка открывает WhatsApp
 * с выбранным планом в тексте. Если номер WhatsApp в js/content/contacts.js пуст, кнопка ведёт к контактам.
 */
export function initPro() {
  const p = ru.pro;
  const root = document.getElementById('pro');
  if (!root) return;
  const radios = Array.from(root.querySelectorAll('[role="radio"]'));
  const cta = root.querySelector('[data-pro-cta]');
  const byWhatsapp = contacts.whatsapp.trim() !== '';
  let plan = p.plans[0].id;

  const paint = () => {
    for (const r of radios) r.setAttribute('aria-checked', String(r.dataset.plan === plan));
    if (!cta || !byWhatsapp) return;
    const chosen = p.plans.find((x) => x.id === plan) ?? p.plans[0];
    cta.href = whatsappHref(contacts.whatsapp, p.message(chosen.title));
  };
  for (const r of radios) r.addEventListener('click', () => { plan = r.dataset.plan; paint(); });

  if (cta) {
    if (byWhatsapp) {
      cta.target = '_blank';
      cta.rel = 'noreferrer';
    } else {
      // без WhatsApp: значок мессенджера не нужен, кнопка прокручивает к контактам
      cta.querySelector('svg')?.remove();
      cta.addEventListener('click', (e) => { e.preventDefault(); scrollToId('contacts'); });
    }
  }
  paint();
}

/** Вопросы и ответы: открыт один ответ; вопросы под ним доезжают на новое место (glide). */
export function initFaq() {
  const list = document.querySelector('[data-faq]');
  if (!list) return;
  const items = Array.from(list.querySelectorAll('.faq__item')).map((item) => ({
    button: item.querySelector('button'),
    answer: item.querySelector('.faq__a'),
  }));
  // какой ответ открыт при загрузке — тот, у которого в разметке нет hidden
  let open = items.findIndex((it) => it.answer && !it.answer.hidden);
  if (open === -1) open = null;

  const paint = () => items.forEach((it, i) => {
    const on = i === open;
    it.button.setAttribute('aria-expanded', String(on));
    if (on) it.button.setAttribute('aria-controls', it.answer.id); else it.button.removeAttribute('aria-controls');
    it.answer.hidden = !on;
  });
  items.forEach((it, i) => it.button.addEventListener('click', () => { open = open === i ? null : i; paint(); }));
  paint();
  glide(list);
}
