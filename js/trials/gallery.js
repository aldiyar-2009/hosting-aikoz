// Галерея: что посетитель снял в пробах. Живёт только в памяти вкладки — закрытие страницы всё убирает.
import { ru } from '../content/ru.js';
import { el, icon, setChildren } from '../ui/dom.js';
import { appear, createSwap } from '../ui/motion.js';
import { closeButton, emptyHint } from '../ui/parts.js';
import { trapDialog } from '../ui/dialog.js';

const t = ru.gallery;
const EXT = { photo: 'jpg', video: 'webm', audio: 'webm' };

/** Миниатюра 96 × 96: фото, первый кадр видео или значок записи; пример помечен словом «пример». */
function thumb(item, onOpen) {
  const node = el('button', { type: 'button', class: 'gal-thumb', 'aria-label': t[item.kind], onclick: onOpen });
  if (item.kind === 'photo') node.append(el('img', { src: item.url, alt: '', class: 'gal-thumb-media' }));
  if (item.kind === 'video') {
    const video = el('video', { src: item.url, playsinline: true, preload: 'metadata', class: 'gal-thumb-media' });
    video.muted = true;
    node.append(video, el('span', { class: 'gal-thumb-play' }, icon('play', 22)));
  }
  if (item.kind === 'audio') node.append(el('span', { class: 'gal-thumb-audio' }, icon('audio-lines', 30)));
  if (item.sample) node.append(el('span', { class: 'chip--solid gal-thumb-tag' }, ru.trials.sampleTag));
  return node;
}

/**
 * Панель галереи. trials — хранилище проб (js/trials/trials.js): из него берутся файлы и удаление.
 * Возвращает { el }.
 */
export function createGallery(trials) {
  let openId = null;
  let untrap = null;
  let animatedOnce = false;
  /** миниатюры по id: при добавлении файла остальные не пересоздаются */
  const thumbs = new Map();

  const count = el('span', { class: 'gal-count', hidden: true });
  const strip = el('div', { class: 'gal-strip' });
  const empty = emptyHint({ iconName: 'images', text: t.empty });
  // полоса держит высоту миниатюры и пустой: первый снимок не сдвигает страницу
  const holder = el('div', { class: 'gal-holder' }, empty);
  const panel = el('section', { class: 'panel', 'aria-label': t.title },
    el('h3', { class: 'h3' }, t.title, count),
    el('p', { class: 'caption gal-privacy' }, icon('lock', 13), t.privacy),
    holder);

  // окно просмотра проявляется и гаснет
  const viewer = createSwap(panel, {
    flow: false, itemClass: 'gal-viewer', shift: 0, enterMs: 200,
    // закрытое окно ещё гаснет на экране, но звук и видео останавливаются сразу
    onLeave: (node) => node?.querySelectorAll?.('video, audio').forEach((m) => m.pause()),
  });

  function close() {
    if (openId === null) return;
    openId = null;
    untrap?.();
    untrap = null;
    viewer.show(null);
  }

  function open(item) {
    if (openId === item.id) return;
    untrap?.();
    openId = item.id;

    let media;
    if (item.kind === 'photo') media = el('img', { src: item.url, alt: item.label ?? t.photo, class: 'gal-view-media gal-view-photo' });
    if (item.kind === 'video') media = el('video', { src: item.url, controls: true, autoplay: true, playsinline: true, class: 'gal-view-media' });
    if (item.kind === 'audio') media = el('div', { class: 'gal-view-audio' }, el('audio', { src: item.url, controls: true, autoplay: true }));

    const box = el('div', { class: 'gal-view-box', onclick: (e) => e.stopPropagation() },
      el('div', { class: 'inset gal-view-inset' }, media),
      el('div', { class: 'gal-view-bar' },
        el('p', { class: 'gal-view-label' }, item.label ?? t[item.kind]),
        el('div', { class: 'gal-view-actions' },
          el('a', { href: item.url, download: `aikoz-${item.kind}.${item.kind === 'audio' && item.sample ? 'wav' : EXT[item.kind]}`, class: 'btn btn--secondary' },
            icon('download', 16), t.download),
          el('button', { type: 'button', class: 'btn btn--secondary', onclick: () => { trials.removeItem(item.id); close(); } },
            icon('trash-2', 16), t.remove),
          closeButton(ru.explore.close, close))));
    // щелчок по затемнению закрывает окно
    const backdrop = el('div', { class: 'gal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': t[item.kind], onclick: close }, box);

    viewer.show(item.id, backdrop);
    // createSwap не анимирует самый первый показ, а окно должно проявляться всегда
    if (!animatedOnce) { animatedOnce = true; appear(backdrop.parentElement, 0, 200); }
    // клавиатура: фокус внутрь, Tab по кругу, Escape закрывает
    untrap = trapDialog(box, close);
  }

  function render(items) {
    count.hidden = items.length === 0;
    count.textContent = String(items.length);
    // убрать миниатюры удалённых файлов
    for (const [id, node] of thumbs) {
      if (!items.some((i) => i.id === id)) { node.remove(); thumbs.delete(id); }
    }
    for (const item of items) {
      if (!thumbs.has(item.id)) thumbs.set(item.id, thumb(item, () => open(item)));
    }
    if (items.length === 0) { setChildren(holder, empty); return; }
    // порядок как в списке: новое — в начале
    items.forEach((item, i) => {
      const node = thumbs.get(item.id);
      if (strip.children[i] !== node) strip.insertBefore(node, strip.children[i] ?? null);
    });
    if (strip.parentNode !== holder) setChildren(holder, strip);
    // открытый файл удалили не из окна — окно закрывается
    if (openId !== null && !items.some((i) => i.id === openId)) close();
  }

  trials.subscribe((_state, items) => render(items));
  render(trials.items);
  return { el: panel };
}
