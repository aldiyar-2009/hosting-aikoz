// Что каждое окно сайта делает для клавиатуры: фокус уходит внутрь при открытии и возвращается
// на прежнее место при закрытии, Tab остаётся внутри, Escape закрывает.

const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, audio[controls], video[controls], [tabindex]:not([tabindex="-1"])';

/**
 * Вызвать, когда окно показано. `box` — элемент окна, onClose — что сделать по Escape.
 * Возвращает функцию: вызвать её, когда окно закрыто (снимает обработчик и возвращает фокус).
 */
export function trapDialog(box, onClose) {
  const back = document.activeElement;
  const inside = () => Array.from(box.querySelectorAll(FOCUSABLE)).filter((node) => node.offsetParent !== null);
  // кнопка «Закрыть» — последний элемент управления каждого окна: с неё безопаснее всего начать
  const all = inside();
  all[all.length - 1]?.focus({ preventScroll: true });
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const list = inside();
    if (list.length === 0) return;
    const first = list[0];
    const last = list[list.length - 1];
    const now = document.activeElement;
    if (!now || !box.contains(now)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && now === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && now === last) { e.preventDefault(); first.focus(); }
  };
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    if (back && document.contains(back)) back.focus({ preventScroll: true });
  };
}
