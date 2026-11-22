// Раздел «Покрутите и нажмите»: свободный осмотр каждого предмета комплекта, точки на модели,
// карточки деталей с жестами, пробы функций и галерея того, что посетитель снял.
import { CONTROLS } from '../content/controls.js';
import { ru } from '../content/ru.js';
import { reducedMotion, watchOnScreen } from '../lib/env.js';
import { createGallery } from '../trials/gallery.js';
import { createTrialPanel } from '../trials/trial-panel.js';
import { createTrials } from '../trials/trials.js';
import { revealDelta } from '../trials/view.js';
import { el, icon, setChildren } from '../ui/dom.js';
import { appear, createSwap, glide } from '../ui/motion.js';
import { closeButton } from '../ui/parts.js';

const t = ru.explore;
const ITEMS = ['glasses', 'case', 'box', 'manual', 'kit'];
const VIEW_IDS = ['front', 'right', 'left', 'top', 'inside'];
/** картинка предмета для браузера без 3D */
const FALLBACK = { glasses: 'glasses_perspective', case: 'case_perspective', box: 'box_01_perspective', manual: 'glasses_perspective', kit: 'kit_in_case_front' };

/** Карточка детали: что это, какие жесты и кнопки «Попробовать». */
function partCard(id, onClose, onTry) {
  const c = CONTROLS.find((x) => x.id === id);
  const card = el('section', { class: 'panel', 'aria-label': c.title },
    el('header', { class: 'ex-card-head' },
      el('div', { class: 'ex-min0' },
        el('h3', { class: 'h3' }, c.title),
        el('p', { class: 'ex-card-text' }, c.text)),
      closeButton(t.close, onClose)));
  if (c.gestures.length > 0) {
    card.append(
      el('p', { class: 'caption ex-card-sub' }, t.gesturesTitle),
      el('ul', { class: 'ex-gestures' }, c.gestures.map((g) =>
        el('li', { class: 'ex-gesture' },
          el('div', { class: 'ex-min0' },
            el('p', { class: 'ex-gesture-label' }, g.label),
            el('p', { class: 'ex-gesture-result' }, g.result)),
          g.trial && el('button', { type: 'button', class: 'btn btn--secondary', onclick: () => onTry(g.trial) }, t.try)))));
    if (id === 'button' || id === 'touchpad' || id === 'slider') {
      card.append(el('p', { class: 'caption ex-on-model' }, icon('hand', 15), t.onModel));
    }
  }
  return card;
}

/** Список деталей: стоит на месте карточки, пока ничего не выбрано. */
function partList(onSelect) {
  return el('section', { class: 'panel', 'aria-label': t.gesturesTitle },
    el('h3', { class: 'h3' }, t.gesturesTitle),
    el('div', { class: 'ex-part-list' }, CONTROLS.map((c) =>
      el('button', { type: 'button', class: 'btn tab', onclick: () => onSelect(c.id) }, c.title))));
}

/**
 * Собрать раздел внутри пустого <section id="explore">.
 *   webgl        — умеет ли браузер 3D (иначе — картинки);
 *   onReadManual — кнопка «Прочитать» у инструкции.
 * Возвращает { setItem(item), prewarm() }: item — 'glasses' | 'case' | 'box' | 'manual' | 'kit';
 * prewarm() — подготовить модели заранее, пока страница отдыхает.
 */
export function initExplore(sectionEl, { webgl, onReadManual }) {
  const trials = createTrials();

  // ---------- состояние раздела ----------
  let item = 'glasses';
  let selected = null;
  let flags = { caseOpen: false, caseWith: true, boxOpen: false, manualOpen: false };
  let ready = false;
  let onScreen = false;
  let pageVisible = document.visibilityState !== 'hidden';
  let prewarmed = false;
  /** 3D-сцена: null — ещё не создана */
  let canvas = null;
  let canvasAsked = false;
  /** что сейчас открыто в правой колонке и его панель */
  let slotId = null;
  let slotSwap = null;
  let slotHost = null;
  let slotPanel = null;
  let seenOpened = null;
  let labelShown = false;

  // таймеры, бесконечные анимации и 3D работают, только пока раздел виден
  const isAwake = () => onScreen && pageVisible;

  // ---------- разметка ----------
  const itemButtons = Object.fromEntries(ITEMS.map((i) =>
    [i, el('button', { type: 'button', class: 'btn tab', 'aria-pressed': 'false', onclick: () => setItem(i) }, t.items[i])]));

  const canvasHost = el('div', { class: 'ex-fill' });
  const fallbackImg = el('img', { class: 'ex-fallback-img', alt: '' });
  const fallback = el('div', { class: 'ex-fallback' }, fallbackImg, el('p', { class: 'ex-fallback-text' }, t.noWebgl));
  // в углу сцены: посередине стоит модель, поверх неё ничего не пишем
  const loading = el('p', { class: 'label ex-loading', role: 'status' }, t.loading);

  // точки на модели: их каждый кадр ставит на место 3D-сцена
  const hotspots = {};
  const hotspotLayer = el('div', { class: 'ex-hotspots' });
  if (webgl) {
    for (const c of CONTROLS) {
      const dot = el('span', { class: 'hotspot-dot' });
      const button = el('button', {
        type: 'button', class: 'hotspot', 'aria-label': c.title, 'aria-pressed': 'false',
        style: { display: 'none' }, onclick: () => setSelected(c.id),
      }, dot);
      hotspots[c.id] = button;
      hotspotLayer.append(button);
    }
  }

  const stage = el('div', { class: 'ex-stage' },
    webgl ? canvasHost : fallback,
    webgl && loading,
    hotspotLayer,
    el('div', { class: 'ex-zoom' },
      el('button', { type: 'button', class: 'btn-icon', 'aria-label': t.zoomOut, onclick: () => canvas?.zoom(1.3) }, icon('minus', 18)),
      el('button', { type: 'button', class: 'btn-icon', 'aria-label': t.zoomIn, onclick: () => canvas?.zoom(0.72) }, icon('plus', 18)),
      el('button', { type: 'button', class: 'btn-icon', 'aria-label': t.reset, onclick: () => { setSelected(null); canvas?.reset(); } }, icon('rotate-ccw', 17))),
    el('p', { class: 'label ex-zoom-hint' }, t.zoomHint));

  // имя выбранной детали остаётся рядом с моделью: выбор виден, даже когда карточка на телефоне ниже экрана
  const labelSwap = createSwap(stage, { flow: false, itemClass: 'label ex-part-label' });

  const actions = el('div', { class: 'ex-actions' });
  const note = el('p', { class: 'ex-note', hidden: true });
  // min-width: 0 — длинная полоса галереи прокручивается внутри своей панели, а не раздвигает страницу
  const column = el('div', { class: 'ex-column' });
  const gallery = createGallery(trials);
  column.append(gallery.el);
  const grid = el('div', { class: 'ex-grid' },
    el('div', { class: 'ex-min0' }, stage, actions, note),
    column);

  sectionEl.classList.add('section', 'ex');
  setChildren(sectionEl, el('div', { class: 'wrap' },
    el('h2', { class: 'h2' }, t.title),
    el('p', { class: 'ex-lead' }, t.text),
    // на телефоне полоса прокручивается вбок; её поля оставляют место для свечения выбранной вкладки
    el('div', { class: 'ex-items', role: 'group', 'aria-label': t.itemsLabel }, ITEMS.map((i) => itemButtons[i])),
    grid));

  // карточка сменила список, панель выросла: соседи под ней доезжают на место, а не прыгают
  const glider = glide(column);

  // страница прокручивается колесом как обычно; Ctrl + колесо приближает модель
  stage.addEventListener('wheel', (e) => { if (!e.ctrlKey) e.stopPropagation(); }, { capture: true });

  // ---------- кнопки под сценой ----------
  const flag = (patch) => { flags = { ...flags, ...patch }; canvas?.set({ flags }); renderActions(false); };
  const actionButton = (onClick, ...content) => el('button', { type: 'button', class: 'btn btn--secondary', onclick: onClick }, content);
  const caseOpenBtn = actionButton(() => flag({ caseOpen: !flags.caseOpen }));
  const caseWithBtn = actionButton(() => flag({ caseWith: !flags.caseWith, caseOpen: true }));
  const boxBtn = actionButton(() => flag({ boxOpen: !flags.boxOpen }));
  const manualBtn = actionButton(() => flag({ manualOpen: !flags.manualOpen }));
  const manualReadBtn = actionButton(() => onReadManual?.(), icon('book-open', 16), t.manualRead);
  const viewButtons = VIEW_IDS.map((v) => actionButton(() => { setSelected(null); canvas?.view(v); }, t.views[v]));
  const ACTIONS = { glasses: viewButtons, case: [caseOpenBtn, caseWithBtn], box: [boxBtn], manual: [manualBtn, manualReadBtn], kit: [] };
  const NOTES = { case: t.caseNote, box: t.boxNote, manual: t.manualNote, kit: t.kitNote };

  /** подписи кнопок; сами кнопки пересобираются, только когда сменился предмет (фокус не теряется) */
  function renderActions(rebuild) {
    caseOpenBtn.textContent = flags.caseOpen ? t.caseClose : t.caseOpen;
    caseWithBtn.textContent = flags.caseWith ? t.caseWithout : t.caseWith;
    boxBtn.textContent = flags.boxOpen ? t.boxClose : t.boxOpen;
    manualBtn.textContent = flags.manualOpen ? t.manualClose : t.manualOpen;
    if (!rebuild) return;
    setChildren(actions, ACTIONS[item]);
    note.hidden = item === 'glasses';
    note.textContent = NOTES[item] ?? '';
  }

  // ---------- правая колонка: список деталей, карточка детали и проба стоят в одном месте ----------

  /** панель закрыта и только гаснет: всё, что она держит, отпускается сразу */
  const releasePanel = () => { slotPanel?.release?.(); slotPanel = null; };

  function renderSlot() {
    const active = trials.state.active;
    const opened = active ? `trial:${active}` : selected ? `part:${selected}` : null;
    const next = opened ?? (item === 'glasses' ? 'list' : null);

    if (next !== slotId) {
      slotId = next;
      if (next === null) {
        // показывать нечего: место убирается целиком, без анимации
        releasePanel();
        slotHost?.remove();
        slotHost = slotSwap = null;
      } else {
        if (!slotHost) {
          slotHost = el('div');
          column.insertBefore(slotHost, column.firstChild);
          // старое гаснет поверх нового, новое приходит: вокруг ничего не толкается
          slotSwap = createSwap(slotHost, { onLeave: releasePanel });
        }
        let panel;
        let node;
        if (active) {
          panel = createTrialPanel(trials, active, isAwake());
          node = panel.el;
        } else if (selected) node = partCard(selected, () => setSelected(null), trials.run);
        else node = partList(setSelected);
        slotSwap.show(next, node);
        slotPanel = panel ?? null;
      }
    } else slotPanel?.update(trials.state);

    // Карточка и проба открываются в одном месте — наверху правой колонки. Если посетитель этого места
    // не видит (телефон, модель во весь экран), страница сдвигается ровно настолько, чтобы показать
    // то, что открылось. Закрытие страницу не двигает никогда.
    if (seenOpened === opened) return;
    seenOpened = opened;
    if (!opened || !slotHost) return;
    const top = revealDelta(slotHost.getBoundingClientRect().top, window.innerHeight);
    if (top !== 0) window.scrollBy({ top, behavior: reducedMotion() ? 'instant' : 'smooth' });
  }

  // ---------- выбор детали и предмета ----------

  function renderSelected() {
    for (const c of CONTROLS) {
      const button = hotspots[c.id];
      if (!button) continue;
      button.setAttribute('aria-pressed', String(selected === c.id));
      button.firstChild.classList.toggle('is-on', selected === c.id);
    }
    const part = selected ? CONTROLS.find((c) => c.id === selected) : null;
    const content = part && [
      el('span', { class: 'ex-part-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'ex-part-name', 'aria-hidden': 'true' }, part.title),
    ];
    const frag = document.createDocumentFragment();
    if (content) frag.append(...content);
    labelSwap.show(part ? part.id : null, part ? frag : null);
    // createSwap не анимирует самый первый показ, а подпись должна приходить всегда
    if (part && !labelShown) { labelShown = true; appear(stage.lastElementChild); }
  }

  function setSelected(id) {
    if (id === selected) return;
    selected = id;
    canvas?.set({ selected });
    renderSelected();
    renderSlot();
  }

  function setItem(next) {
    if (!ITEMS.includes(next) || next === item) return;
    item = next;
    // точки и карточки есть только у очков
    if (item !== 'glasses') selected = null;
    canvas?.set({ item, selected });
    renderItem();
    renderSelected();
    renderSlot();
  }

  function renderItem() {
    for (const i of ITEMS) {
      itemButtons[i].setAttribute('aria-pressed', String(item === i));
      itemButtons[i].classList.toggle('is-on', item === i);
    }
    if (!webgl) {
      fallbackImg.src = `img/${FALLBACK[item]}.jpg`;
      fallbackImg.alt = t.items[item];
    }
    renderActions(true);
  }

  // ---------- 3D-сцена ----------

  /**
   * Модели собираются и уходят в видеокарту один раз, и это занимает время. Делается заранее, пока
   * посетитель читает первый экран (prewarm), — или когда он сам дошёл до раздела.
   */
  function mountCanvas() {
    if (!webgl || canvasAsked) return;
    canvasAsked = true;
    import('../explore/explore-canvas.js').then(({ createExploreCanvas }) => {
      canvas = createExploreCanvas(canvasHost, {
        hotspots,
        onGesture: (control, g) => trials.gesture(control, g),
        onReady: () => { ready = true; loading.hidden = true; },
      });
      canvas.set({ item, flags, selected, trial: trials.state });
      canvas.setActive(isAwake());
    }).catch((err) => { canvasAsked = false; console.error(err); });
  }

  // ---------- виден раздел или нет ----------

  function renderAwake() {
    const awake = isAwake();
    // вне экрана и на скрытой вкладке все бесконечные анимации раздела стоят
    grid.classList.toggle('is-asleep', !awake);
    for (const button of Object.values(hotspots)) button.classList.toggle('is-paused', !awake);
    glider.enabled = awake;
    slotPanel?.setAwake(awake);
    canvas?.setActive(awake);
  }

  watchOnScreen(sectionEl, (on) => {
    onScreen = on;
    if (on || prewarmed) mountCanvas();
    renderAwake();
  });
  document.addEventListener('visibilitychange', () => {
    pageVisible = document.visibilityState !== 'hidden';
    renderAwake();
  });
  // страницу закрывают: камера, микрофон и звук отпускаются
  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    releasePanel();
    trials.dispose();
  });

  trials.subscribe((state) => {
    canvas?.set({ trial: state });
    renderSlot();
  });

  renderItem();
  renderSelected();
  renderSlot();
  renderAwake();

  return {
    setItem,
    prewarm() { prewarmed = true; mountCanvas(); },
  };
}
