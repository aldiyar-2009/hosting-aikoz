// 3D-модели комплекта и общий свет сцены. Этим файлом пользуются и история распаковки
// (js/scene/story-canvas.js), и раздел «Покрутите и нажмите».
//
// Что отсюда можно взять:
//
//   NAMES                     — имена моделей: ['box', 'glasses', 'case', 'manual', 'extras'].
//   preloadKit()              — Promise<void>. Заранее скачать и разобрать все пять .glb (models/<имя>.glb).
//                               Файлы качаются один раз на страницу, сколько бы раз ни вызывали.
//   loadKit()                 — Promise<Kit>. Свой набор моделей для ОДНОЙ сцены (копия дерева объектов;
//                               геометрия, материалы и текстуры общие, скачанные один раз). Каждая сцена
//                               зовёт loadKit() сама и получает свою копию.
//                               Kit = { box, glasses, case, manual, extras, part(name) }:
//                                 box … extras — THREE.Object3D, корни моделей (в сцену добавляете сами);
//                                 part(name)   — найти именованную часть (Box_Lid, Box_Base, Case_Flap,
//                                                Temple_L, Temple_R, Manual_P1…P4, Btn_Capture, Touchpad,
//                                                POI_…); если такой части нет — бросает ошибку.
//                               Стекло линз (материал 'Lens') уже сделано прозрачным.
//   LIGHT                     — цвета света и свечения деталей: { key, rim, fill, glow, press } (строки HEX).
//   createStudio(gl, scene)   — поставить ночной свет в сцену: окружение для отражений (без скачивания HDR)
//                               и четыре источника света. Возвращает { dispose() } — убрать свет и освободить
//                               память. gl — THREE.WebGLRenderer.
//   createRenderer(canvas?)   — THREE.WebGLRenderer с теми же настройками, что были у сайта на React
//                               (сглаживание, прозрачный фон, sRGB, тональная кривая ACES).
//   pixelRatio()              — плотность пикселей для рендера: от 1 до 1,75.
//   warmUp(gl, scene, camera) — Promise<void>. Подготовить всю сцену до показа: собрать шейдеры и один раз
//                               нарисовать кадр, где видна каждая деталь. После этого ничего не дёргается.
//   foldManual(kit, angle)    — сложить инструкцию гармошкой: угол сгиба в радианах (0 — развёрнута).

import * as THREE from '../../vendor/three.module.min.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { RoomEnvironment } from '../../vendor/RoomEnvironment.js';

export const NAMES = ['box', 'glasses', 'case', 'manual', 'extras'];
// пути считаются от страницы (index.html лежит рядом с папкой models)
const URLS = NAMES.map((n) => `models/${n}.glb`);

/** общий запас: одно обещание на все пять файлов */
let gltfsPromise = null;

/** Скачать и разобрать модели (один раз на страницу). */
function loadGltfs() {
  if (!gltfsPromise) {
    const loader = new GLTFLoader();
    gltfsPromise = Promise.all(URLS.map((url) => loader.loadAsync(url)));
    // не удалось — следующая попытка скачает заново
    gltfsPromise.catch(() => { gltfsPromise = null; });
  }
  return gltfsPromise;
}

/** Заранее скачать модели, пока посетитель читает первый экран. */
export function preloadKit() {
  return loadGltfs().then(() => undefined);
}

/** Набор моделей для одной сцены: своя копия дерева объектов. */
export async function loadKit() {
  const gltfs = await loadGltfs();
  const roots = gltfs.map((g) => g.scene.clone(true));
  const [box, glasses, case_, manual, extras] = roots;
  // линзы: почти прозрачное гладкое стекло
  for (const root of roots) {
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const mat = mesh.material;
      if (mat.name === 'Lens') {
        const lens = mat.clone();
        lens.transparent = true;
        lens.opacity = 0.11;
        lens.roughness = 0.04;
        lens.depthWrite = false;
        mesh.material = lens;
        mesh.renderOrder = 2;
      }
    });
  }
  // части спрашивают на каждом кадре (сгибы инструкции): каждое имя ищется один раз
  const found = new Map();
  const part = (name) => {
    const known = found.get(name);
    if (known) return known;
    for (const root of roots) {
      const hit = root.getObjectByName(name);
      if (hit) { found.set(name, hit); return hit; }
    }
    throw new Error(`Model part "${name}" not found`);
  };
  return { box, glasses, case: case_, manual, extras, part };
}

/** Цвета 3D-света и свечения деталей (three.js нужны значения, а не переменные CSS). */
export const LIGHT = {
  key: '#DCE4FF',
  rim: '#FFE3BC',
  fill: '#BFC9FF',
  /** свечение выбранной детали: ореол луны */
  glow: '#BFC9FF',
  /** свечение детали в момент нажатия: лунный свет */
  press: '#F1EFE6',
};

/**
 * Ночной свет без скачивания HDR. Луна стоит за предметами (её рисует страница), поэтому свет поставлен
 * как при съёмке в лунную ночь: холодный основной спереди, тёплый контровой сзади — он обводит тёмную
 * оправу на фоне диска, — и тусклая нарисованная комната для отражений на глянце.
 */
export function createStudio(gl, scene) {
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.6;

  const lights = new THREE.Group();
  const ambient = new THREE.AmbientLight(LIGHT.fill, 0.22);
  // основной: холодный лунный свет
  const key = new THREE.DirectionalLight(LIGHT.key, 1.7);
  key.position.set(-1.4, 2.4, 3);
  // контровой: тёплый свет низкой луны, сзади и сверху
  const rim = new THREE.DirectionalLight(LIGHT.rim, 1.1);
  rim.position.set(1.6, 1.4, -2.6);
  const fill = new THREE.DirectionalLight(LIGHT.fill, 0.45);
  fill.position.set(-2.4, 0.3, -1.6);
  lights.add(ambient, key, rim, fill);
  scene.add(lights);

  return {
    dispose() {
      scene.remove(lights);
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    },
  };
}

/** Плотность пикселей для рендера: не меньше 1 и не больше 1,75 (на телефонах с плотным экраном — экономия). */
export const pixelRatio = () => Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));

/** Рендерер с настройками сайта: сглаживание, прозрачный фон, цвет sRGB, тональная кривая ACES. */
export function createRenderer(canvas) {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.setPixelRatio(pixelRatio());
  return gl;
}

/**
 * Подготовить весь комплект до показа. Без этого шейдеры собираются, а модели уходят в видеокарту
 * в момент, когда деталь впервые появляется, — посреди истории (очки, поднимающиеся из кейса, стоили
 * четверть секунды) или при первом переключении предмета.
 * Шейдеры собираются в фоне, где браузер это умеет; затем рисуется один кадр, где видна каждая деталь:
 * так в видеокарту уходят вся геометрия и все текстуры. Обещание выполняется, когда сцену можно показывать.
 */
export async function warmUp(gl, scene, camera) {
  try {
    await gl.compileAsync(scene, camera);
  } catch {
    gl.compile(scene, camera);
  }
  const hidden = [];
  const culled = [];
  scene.traverse((o) => {
    if (!o.visible) { hidden.push(o); o.visible = true; }
    // деталь вне кадра была бы пропущена, и её загрузка снова отложилась бы
    if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
  });
  gl.render(scene, camera);
  for (const o of hidden) o.visible = false;
  for (const o of culled) o.frustumCulled = true;
}

/** Углы сгиба четырёх нижних листов инструкции (гармошка): +a, −a, +a, −a вокруг оси X. */
export function foldManual(kit, angle) {
  for (let i = 1; i <= 4; i++) kit.part(`Manual_P${i}`).rotation.x = i % 2 ? angle : -angle;
}
