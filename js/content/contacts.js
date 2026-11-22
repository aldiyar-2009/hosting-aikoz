// Контакты сайта — единственное место, где они записаны.
// Впишите свои значения между кавычками. Пустое поле ('') на сайте не показывается.
export const contacts = {
    /** Телефон в международном виде, как показывать на сайте: '+7 700 000 00 00' */
    phone: '+7 778 800 44 77',
    /** Номер WhatsApp в международном виде (можно тот же, что телефон) */
    whatsapp: '+7 778 800 44 77',
    /** Почта: 'hello@example.kz' */
    email: '',
    /** Instagram: имя без @ или ссылка на страницу */
    instagram: '',
    /** Telegram: имя без @ или ссылка t.me/… */
    telegram: '',
};
const digits = (s) => s.replace(/\D/g, '');
/** 'name', '@name' or a full link -> 'name' */
const handle = (s) => s.trim().replace(/\/+$/, '').split('/').pop().replace(/^@/, '');
export const phoneHref = (phone) => `tel:+${digits(phone)}`;
export const whatsappHref = (number, text = '') => `https://wa.me/${digits(number)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const mailHref = (email, subject = '', body = '') => `mailto:${email.trim()}${subject || body ? `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : ''}`;
export const instagramHref = (name) => `https://www.instagram.com/${handle(name)}/`;
export const telegramHref = (name) => `https://t.me/${handle(name)}`;
/** The filled-in contacts, in the order they are shown. `text` is the ready message for WhatsApp. */
export function contactLinks(c = contacts, text = '') {
    const all = [
        { kind: 'phone', value: c.phone.trim(), href: phoneHref(c.phone) },
        { kind: 'whatsapp', value: c.whatsapp.trim(), href: whatsappHref(c.whatsapp, text) },
        { kind: 'email', value: c.email.trim(), href: mailHref(c.email) },
        { kind: 'instagram', value: `@${handle(c.instagram)}`, href: instagramHref(c.instagram) },
        { kind: 'telegram', value: `@${handle(c.telegram)}`, href: telegramHref(c.telegram) },
    ];
    return all.filter((l) => c[l.kind].trim() !== '');
}
