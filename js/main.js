// Вход сайта: собирает страницу из готовых частей. Тексты и разметка разделов — в index.html,
// здесь только поведение: небо, шапка, распаковка, 3D-осмотр, подписка, вопросы, контакты.
import { tidy } from './content/typo.js';
import { hasWebGL, onReducedMotionChange, reducedMotion, scrollToId } from './lib/env.js';
import { mountSpaceSky } from './moon/space-sky.js';
import { createStars } from './moon/stars.js';
import { initHeader, openManual } from './sections/chrome.js';
import { initContacts } from './sections/contacts.js';
import { initFaq, initPro } from './sections/info.js';
import { initStoryStatic } from './sections/story-static.js';

/** страница простояла столько мс без прокрутки: хороший момент для работы, заметной во время прокрутки */
const REST_MS = 500;

/** Каждый шаг запуска — отдельно: ошибка в одном разделе не ломает остальные. */
function safely(name, run) {
  try { return run(); } catch (error) { console.warn(`Aikoz: «${name}» не запустился`, error); return undefined; }
}

// ---------- небо ----------
safely('космос', mountSpaceSky);
// редкие звёзды первого экрана: только со стороны луны, под текстом их нет (маска в css/page.css)
safely('звёзды первого экрана', () => {
  const sky = document.querySelector('[data-hero-stars]');
  if (sky) sky.append(createStars({ count: 64, seed: 11 }).el);
});

// ---------- тексты ----------
// короткие слова (в, и, на, для…) не остаются одни в конце строки: во всех блоках с data-tidy
safely('типографика', () => {
  for (const block of document.querySelectorAll('[data-tidy]')) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = tidy(node.nodeValue);
      if (text !== node.nodeValue) node.nodeValue = text;
    }
  }
  // год в подвале
  for (const year of document.querySelectorAll('[data-year]')) year.textContent = String(new Date().getFullYear());
});

// ---------- шапка, подписка, вопросы, контакты ----------
safely('шапка', initHeader);
safely('подписка', initPro);
safely('вопросы и ответы', initFaq);
safely('контакты', initContacts);

// кнопки-переходы: data-go="id раздела"
for (const button of document.querySelectorAll('[data-go]')) {
  button.addEventListener('click', () => scrollToId(button.dataset.go));
}
// «Прочитать инструкцию»
for (const button of document.querySelectorAll('[data-read-manual]')) button.addEventListener('click', openManual);

// ---------- «Покрутите и нажмите» (3D-осмотр; js/sections/explore.js) ----------
const webgl = hasWebGL();
let explore = null;
/** история готова и страница отдохнула: модели осмотра можно готовить заранее */
let prewarmWanted = false;
/** что показать в осмотре, если кнопку нажали раньше, чем раздел загрузился */
let itemWanted = null;

const exploreSection = document.getElementById('explore');
if (exploreSection) {
  import('./sections/explore.js')
    .then((m) => {
      explore = m.initExplore(exploreSection, { webgl, onReadManual: openManual });
      if (itemWanted) explore.setItem(itemWanted);
      if (prewarmWanted) explore.prewarm();
    })
    .catch((error) => console.warn('Aikoz: раздел «Покрутите и нажмите» не загрузился', error));
}

// «Посмотреть комплект в 3D»: показать комплект и прокрутить к осмотру
for (const button of document.querySelectorAll('[data-see-kit]')) {
  button.addEventListener('click', () => {
    if (explore) safely('комплект', () => explore.setItem('kit')); else itemWanted = 'kit';
    scrollToId('explore');
  });
}

// Модели осмотра готовятся один раз, и это занимает главный поток на мгновение. Оно тратится, пока
// страница стоит: история готова, а посетитель какое-то время не прокручивает (читает первый экран).
function armPrewarm() {
  if (prewarmWanted) return;
  let timer;
  const go = () => {
    window.removeEventListener('scroll', arm);
    if (prewarmWanted) return;
    prewarmWanted = true;
    if (explore) safely('подготовка моделей', () => explore.prewarm());
  };
  const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 1500 }) : go());
  const arm = () => { clearTimeout(timer); timer = setTimeout(idle, REST_MS); };
  arm();
  window.addEventListener('scroll', arm, { passive: true });
}

// ---------- «Распаковка» ----------
// С 3D и без настройки «меньше движения» — история, которую ведёт прокрутка (js/sections/story.js);
// иначе та же история шагами с картинками (js/sections/story-static.js).
const storySection = document.getElementById('story');
let story = null;
/** номер запуска: если настройку переключили, пока 3D-история ещё грузилась, опоздавшая не ставится */
let storyRun = 0;

function clearStory() {
  safely('остановка распаковки', () => story?.destroy());
  story = null;
  storySection.replaceChildren();
  storySection.removeAttribute('style');
  storySection.removeAttribute('class');
}

function startStory() {
  const run = ++storyRun;
  clearStory();
  const fallback = () => { story = safely('распаковка шагами', () => initStoryStatic(storySection)) ?? null; };
  if (!webgl || reducedMotion()) { fallback(); return; }
  // динамический импорт: браузер без 3D не скачивает three.js
  import('./sections/story.js')
    .then((m) => {
      if (run !== storyRun) return;
      story = m.initStory(storySection, { onReady: armPrewarm });
    })
    .catch((error) => {
      console.warn('Aikoz: 3D-распаковка не загрузилась, показываем шаги с картинками', error);
      if (run !== storyRun) return;
      clearStory();
      fallback();
    });
}

if (storySection) {
  startStory();
  // настройку «меньше движения» переключили — меняем вид истории на ходу
  if (webgl) onReducedMotionChange(startStory);
}
