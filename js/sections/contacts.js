// Раздел «Контакты»: способы связи и форма вопроса. Форма сама ничего не отправляет: она открывает
// WhatsApp или почту с готовым текстом, а «отправить» нажимает посетитель.
// Контакты берутся из js/content/contacts.js; пустое поле на сайте не показывается.
import { contactLinks, contacts, mailHref, whatsappHref } from '../content/contacts.js';
import { ru } from '../content/ru.js';
import { tidy } from '../content/typo.js';
import { el, icon, setChildren } from '../ui/dom.js';

const t = ru.contacts;
/** значок каждого способа связи (имена — из img/icons.svg) */
const ICONS = { phone: 'phone', whatsapp: 'message-circle', email: 'mail', instagram: 'instagram', telegram: 'send' };

export function initContacts() {
  const root = document.getElementById('contacts');
  if (!root) return;

  // ---- список контактов ----
  const list = root.querySelector('[data-contact-links]');
  if (list) {
    setChildren(list, contactLinks(contacts, t.messagePrefix).map((l) => {
      // телефон и почта открываются на устройстве, остальное — в новой вкладке
      const outside = l.kind !== 'phone' && l.kind !== 'email';
      return el('li', {},
        el('a', { href: l.href, target: outside && '_blank', rel: outside && 'noreferrer', class: 'contacts__link' },
          el('span', { class: 'icon-disc' }, icon(ICONS[l.kind], 20)),
          el('span', { class: 'contacts__link-body' },
            el('span', { class: 'caption contacts__link-kind' }, t[l.kind]),
            el('span', { class: 'contacts__link-value' }, l.value))));
    }));
  }

  // ---- форма вопроса: есть, только если указан WhatsApp или почта ----
  const form = root.querySelector('[data-question-form]');
  if (!form) return;
  const byWhatsapp = contacts.whatsapp.trim() !== '';
  const byMail = contacts.email.trim() !== '';
  if (!byWhatsapp && !byMail) { form.remove(); return; }
  form.hidden = false;
  form.addEventListener('submit', (e) => e.preventDefault());

  const name = form.querySelector('[name="name"]');
  const question = form.querySelector('[name="question"]');
  const note = form.querySelector('#question-note');
  const send = form.querySelector('[data-send]');
  const ready = () => question.value.trim().length > 0;
  // текст сообщения: приветствие, имя (если написано) и вопрос
  const message = () => [t.messagePrefix, name.value.trim() && `${t.myNameIs} ${name.value.trim()}.`, question.value.trim()].filter(Boolean).join('\n');

  // пустой вопрос: кнопка ничего не открывает, а показывает, где писать
  let asked = false;
  const paintNote = () => {
    const warn = asked && !ready();
    note.classList.toggle('is-asked', warn);
    note.textContent = warn ? t.needQuestion : tidy(byMail ? t.formNoteMail : t.formNote);
  };
  const guard = (e) => {
    if (ready()) return;
    e.preventDefault();
    asked = true;
    paintNote();
    question.focus();
  };

  const viaWhatsapp = byWhatsapp && el('a', {
    target: '_blank', rel: 'noreferrer', class: 'btn btn--primary btn--lg btn-wide-sm', onclick: guard,
  }, icon('message-circle', 17), ' ', t.viaWhatsapp);
  const viaMail = byMail && el('a', {
    class: `btn ${byWhatsapp ? 'btn--secondary' : 'btn--primary'} btn--lg btn-wide-sm`, onclick: guard,
  }, icon('mail', 17), ' ', t.viaEmail);
  setChildren(send, viaWhatsapp, viaMail);

  // ссылки кнопок всегда несут то, что сейчас написано в форме
  const paintLinks = () => {
    if (viaWhatsapp) viaWhatsapp.href = whatsappHref(contacts.whatsapp, message());
    if (viaMail) viaMail.href = mailHref(contacts.email, t.messagePrefix, message());
    paintNote();
  };
  name.addEventListener('input', paintLinks);
  question.addEventListener('input', paintLinks);
  paintLinks();
}
