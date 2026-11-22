// Маленькие помощники для сборки разметки из JS. Текст всегда вставляется как текст (без innerHTML).

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Создать элемент: el('button', { class: 'btn', type: 'button', onclick: fn, 'aria-label': '…' }, 'Текст', другойЭлемент).
 * Свойства: `class`, `text`, `style` (объект), `dataset` (объект), `on…` (обработчик), остальное — атрибуты.
 * Значения null, undefined и false пропускаются, true ставит пустой атрибут. Дети: строки, элементы, массивы.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

/** Добавить детей: строки становятся текстом, пустые значения пропускаются. */
export function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Заменить содержимое элемента. */
export function setChildren(node, ...children) {
  node.replaceChildren();
  return append(node, children);
}

/**
 * Значок из спрайта img/icons.svg (контуры Lucide): icon('camera', 18).
 * Имена — как в Lucide: 'camera', 'message-circle', 'skip-forward'… Полный список — id в img/icons.svg.
 */
export function icon(name, size = 18, className = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.width = `${size}px`;
  svg.style.height = `${size}px`;
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `img/icons.svg#${name}`);
  svg.append(use);
  return svg;
}

/** Создать SVG-элемент с атрибутами: svgEl('circle', { cx: 24, cy: 24, r: 21 }). */
export function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child) node.append(child);
  return node;
}
