// 3D-сцена раздела «Покрутите и нажмите»: свободный осмотр комплекта, точки на модели, жесты на деталях.
// Кадр рисуется ПО ТРЕБОВАНИЮ: только пока что-то движется или что-то изменили (invalidate()).
// Модель стоит — видеокарта отдыхает. Вне экрана и на скрытой вкладке не рисуется ничего (setActive(false)).
import * as THREE from '../../vendor/three.module.min.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { CONTROLS } from '../content/controls.js';
import { createRenderer, createStudio, foldManual, LIGHT, loadKit, pixelRatio, warmUp } from '../scene/models.js';
import { FLAP_OPEN, MANUAL_FOLDED, SLOT, TEMPLE_L_FOLDED, TEMPLE_R_FOLDED } from '../scene/timeline.js';
import { createRecognizer } from './gestures.js';

/** сколько секунд светится нажатая деталь */
const PRESS_GLOW = 0.45;
/** свечение выбранной детали: ровный ореол (нажатая вспыхивает ярче, лунным светом) */
const CHOSEN_GLOW = 0.55;
/** кадры после того, как всё остановилось: у каждой точки успевает провериться «скрыта или нет» */
const SETTLE_FRAMES = 2 * CONTROLS.length + 2;

const HIDE = { p: [0, 0, 0], r: [0, 0, 0], s: 0 };
const BOX_Y = -0.03;
const DEG = Math.PI / 180;

/** виды очков для кнопок под сценой: где стоит камера и куда смотрит */
const VIEWS = {
  front: { pos: [0.1, 0.06, 0.34], target: [0, 0, -0.03] },
  right: { pos: [-0.42, 0.05, 0.1], target: [-0.07, 0.015, -0.07] },
  left: { pos: [-0.02, 0.035, -0.07], target: [0.07, 0.017, -0.03] },
  top: { pos: [0, 0.5, 0.02], target: [0, 0, -0.06] },
  inside: { pos: [0.05, 0.06, -0.42], target: [0, 0, -0.02] },
};

const START_FLAGS = { caseOpen: false, caseWith: true, boxOpen: false, manualOpen: false };

/** Где что стоит для каждого предмета переключателя. Масштаб 0 — убрано. */
function layoutFor(item, f) {
  const base = { box: HIDE, case: HIDE, glasses: HIDE, manual: HIDE, extras: HIDE, lid: [0, 0, 0], flap: 0, templeL: 0, templeR: 0, fold: MANUAL_FOLDED };
  switch (item) {
    case 'case': {
      const inside = f.caseWith && f.caseOpen;
      return {
        ...base,
        case: { p: [0, -0.0275, 0], r: [0, 0, 0], s: 1 },
        glasses: inside ? { p: [SLOT[0], -0.0275 + SLOT[1], SLOT[2]], r: [0, 0, 0], s: 1 } : { ...HIDE, p: [SLOT[0], -0.0275 + SLOT[1], SLOT[2]] },
        flap: f.caseOpen ? FLAP_OPEN : 0, templeL: TEMPLE_L_FOLDED, templeR: TEMPLE_R_FOLDED,
        cam: { pos: [-0.14, 0.17, 0.34], target: [0, 0.01, 0], wide: 1.15 },
      };
    }
    case 'box':
      return {
        ...base,
        box: { p: [0, BOX_Y, 0], r: [0, 0, 0], s: 1 },
        case: { p: [-0.01335, BOX_Y + 0.0296, 0.0491], r: [-90 * DEG, 0, 0], s: 1 },
        manual: { p: [-0.01335, BOX_Y + 0.0428, -0.0557], r: [0, 0, 0], s: 1 },
        extras: { p: [0, BOX_Y, 0], r: [0, 0, 0], s: 1 },
        lid: f.boxOpen ? [0, 0.075, -0.14] : [0, 0, 0],
        cam: { pos: [-0.24, 0.4, 0.5], target: [0, 0.02, -0.05], wide: 1.5 },
      };
    case 'manual':
      return {
        ...base,
        manual: f.manualOpen ? { p: [0, 0.115, 0], r: [90 * DEG, 0, 0], s: 1 } : { p: [0, 0.023, 0], r: [90 * DEG, 0, 0], s: 1 },
        fold: f.manualOpen ? 0 : MANUAL_FOLDED,
        cam: { pos: [0, 0, f.manualOpen ? 0.62 : 0.42], target: [0, 0, 0], wide: f.manualOpen ? 1.0 : 1.3 },
      };
    case 'kit':
      return {
        ...base,
        box: { p: [-0.155, -0.03, -0.08], r: [0, 0.2, 0], s: 1 },
        case: { p: [0.065, -0.03, -0.085], r: [0, -0.25, 0], s: 1 },
        manual: { p: [-0.155, -0.0295, 0.035], r: [0, 0.1, 0], s: 1 },
        glasses: { p: [-0.02, -0.0078, 0.115], r: [0, -0.15, 0], s: 1 },
        extras: { p: [0.072, -0.0327, 0.075], r: [0, 0, 0], s: 1 },
        cam: { pos: [0, 0.5, 0.62], target: [0, -0.02, 0.01], wide: 1.7 },
      };
    case 'glasses':
    default:
      return { ...base, glasses: { p: [0, 0, 0], r: [0, 0, 0], s: 1 }, cam: { ...VIEWS.front, wide: 1.0 } };
  }
}

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** Двигает предмет к его месту; true — он ещё в пути. */
function approach(o, t, k) {
  const far =
    Math.abs(t.p[0] - o.position.x) + Math.abs(t.p[1] - o.position.y) + Math.abs(t.p[2] - o.position.z) > 0.0002 ||
    Math.abs(t.r[0] - o.rotation.x) + Math.abs(t.r[1] - o.rotation.y) + Math.abs(t.r[2] - o.rotation.z) > 0.002 ||
    Math.abs(t.s - Math.max(o.scale.x, 0)) > 0.002;
  // уже рядом: встать точно на место, чтобы сцена могла отдыхать
  const step = far ? k : 1;
  o.position.x += (t.p[0] - o.position.x) * step;
  o.position.y += (t.p[1] - o.position.y) * step;
  o.position.z += (t.p[2] - o.position.z) * step;
  o.rotation.x += (t.r[0] - o.rotation.x) * step;
  o.rotation.y += (t.r[1] - o.rotation.y) * step;
  o.rotation.z += (t.r[2] - o.rotation.z) * step;
  const s = o.scale.x + (t.s - o.scale.x) * step;
  o.scale.setScalar(Math.max(s, 0.0001));
  o.visible = s > 0.03;
  return far;
}

/** Двигает число к цели; far — оно ещё в пути. */
function ease(from, to, k, eps) {
  const far = Math.abs(to - from) > eps;
  return { value: far ? from + (to - from) * k : to, far };
}

/**
 * Создать сцену в блоке `host` (он должен иметь размеры; канвас занимает его целиком).
 *
 *   hotspots  — { id детали: кнопка-точка }: сцена каждый кадр ставит их на место (transform) и прячет.
 *   onGesture — (control, gesture): жест, сделанный прямо на модели ('button' | 'touchpad' | 'slider').
 *   onReady   — модели загружены, собраны и отправлены в видеокарту: сцену можно показывать.
 *
 * Возвращает:
 *   set({ item, flags, selected, trial }) — что показывать (можно передавать только изменившееся);
 *   setActive(on) — раздел виден / не виден;
 *   zoom(factor), view(id), reset() — кнопки под сценой;
 *   dispose() — убрать сцену и освободить память.
 */
export function createExploreCanvas(host, { hotspots, onGesture, onReady }) {
  // мягкий свет за моделью, чтобы чёрная оправа читалась на тёмной сцене (луны здесь нет:
  // смотреть нужно только на модель; звёзд тоже нет — мелкие точки путались бы с точками на модели)
  const sky = document.createElement('div');
  sky.className = 'explore-sky';
  sky.setAttribute('aria-hidden', 'true');
  const glowEl = document.createElement('div');
  glowEl.className = 'explore-glow';
  sky.append(glowEl);

  const canvas = document.createElement('canvas');
  canvas.className = 'explore-canvas';
  // палец на сцене вращает модель, а не прокручивает страницу
  canvas.style.touchAction = 'none';
  host.append(sky, canvas);

  const gl = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.005, 10);
  camera.position.set(0, 0.03, 0.46);
  camera.lookAt(0, 0, 0);
  const studio = createStudio(gl, scene);
  const clock = new THREE.Clock();

  const size = { width: 1, height: 1 };
  let disposed = false;
  let active = false;
  let raf = 0;
  /** сцена собрана (модели загружены) */
  let rig = null;
  let kit = null;
  let controls = null;

  let state = { item: 'glasses', flags: START_FLAGS, selected: null, trial: null };
  let layout = layoutFor(state.item, state.flags);

  const anim = {
    flap: 0, templeL: 0, templeR: 0, fold: MANUAL_FOLDED, pressUntil: 0, lastPress: 0, slide: 0,
    /** когда каждую деталь нажали в последний раз (часы сцены) и уже виденные счётчики нажатий */
    pressedAt: { button: -1e9, touchpad: -1e9, slider: -1e9 }, seen: { button: 0, touchpad: 0, slider: 0 },
    /** сколько кадров ещё нарисовать после последнего движения */
    settle: SETTLE_FRAMES,
  };
  const fly = { active: false, pos: new THREE.Vector3(), target: new THREE.Vector3() };
  /** держать прицел на детали, пока очки ещё встают на место */
  let chase = null;
  const ray = new THREE.Raycaster();
  const pick = new THREE.Raycaster();
  const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), frame: 0, hidden: {} };

  // ---------- кадры по требованию ----------

  /** Попросить кадр. Любое новое движение в сцене обязано позвать это само. */
  function invalidate() {
    if (disposed || !active || raf) return;
    raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    if (disposed || !active) return;
    const delta = clock.getDelta();
    if (rig) update(delta);
    gl.render(scene, camera);
  }

  const aspect = () => size.width / Math.max(size.height, 1);

  /** размер блока изменился: новый размер канваса и новый кадр */
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h || (w === size.width && h === size.height)) return;
    const wasWide = aspect() > 1;
    size.width = w;
    size.height = h;
    gl.setPixelRatio(pixelRatio());
    gl.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    anim.settle = SETTLE_FRAMES;
    // блок стал уже или шире своей высоты: камера заново встаёт так, чтобы всё помещалось
    if (rig && wasWide !== aspect() > 1) flyTo(layout.cam.pos, layout.cam.target, layout.cam.wide);
    // setSize очищает канвас: на скрытой сцене рисуем кадр сразу, иначе она осталась бы пустой
    if (rig && !active) gl.render(scene, camera);
    invalidate();
  }
  const sizes = new ResizeObserver(resize);
  sizes.observe(host);
  resize();

  // ---------- камера ----------

  function flyTo(pos, target, wide = 0) {
    const p = Array.isArray(pos) ? v3(pos) : pos.clone();
    const t = Array.isArray(target) ? v3(target) : target.clone();
    // узкая сцена: отойти назад, чтобы широкие предметы помещались
    if (wide > 0) p.sub(t).multiplyScalar(Math.max(1, wide / Math.max(aspect(), 0.3))).add(t);
    fly.pos.copy(p);
    fly.target.copy(t);
    fly.active = true;
    invalidate();
  }

  /** подлететь к выбранной детали */
  function flyToSelected() {
    const id = state.selected;
    const c = CONTROLS.find((x) => x.id === id);
    if (!rig || !c) return;
    const p = rig.pois[id].getWorldPosition(new THREE.Vector3());
    flyTo(p.clone().add(v3(c.view)), p);
    // очки могут ещё раскладываться или возвращаться от другого предмета: следим за деталью, пока не встанут
    const settled = kit.glasses.scale.x > 0.98 && Math.abs(anim.templeL) < 0.02 && Math.abs(anim.templeR) < 0.02;
    chase = settled ? null : { id, until: performance.now() + 1600 };
  }

  // ---------- жесты прямо на модели ----------

  const makeRecognizer = (control, swipePx) => createRecognizer({ swipePx, onGesture: (g) => onGesture(control, g) });
  const recognizers = { button: makeRecognizer('button', 1e9), touchpad: makeRecognizer('touchpad', 26), slider: makeRecognizer('slider', 1e9) };
  /** снять слушатели начатого жеста (сцену убирают посреди нажатия) */
  let dropPress = null;

  function onPointerDown(e) {
    if (!rig || state.item !== 'glasses') return;
    // луч из камеры через точку нажатия; ближайшая деталь с пометкой control принимает жест
    const box = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    scene.updateMatrixWorld();
    pick.setFromCamera(ndc, camera);
    const hit = pick.intersectObject(rig.pack, true).find((h) => h.object.userData.control);
    if (!hit) return;
    const control = hit.object.userData.control;
    // пока палец на детали, модель не вращается
    controls.enabled = false;
    // направление на экране «к линзе» вдоль дужки — для свайпов по тачпаду
    const a = rig.pad.localToWorld(new THREE.Vector3(0, 0, -0.02)).project(camera);
    const b = rig.pad.localToWorld(new THREE.Vector3(0, 0, 0.02)).project(camera);
    const dir = new THREE.Vector2((b.x - a.x) * size.width, -(b.y - a.y) * size.height).normalize();
    const along = (ev) => (control === 'touchpad' ? ev.clientX * dir.x + ev.clientY * dir.y : 0);
    recognizers[control].down(along(e));
    const drop = () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      dropPress = null;
      if (controls) controls.enabled = true;
    };
    const up = (ev) => { drop(); recognizers[control].up(along(ev)); };
    const cancel = () => { drop(); recognizers[control].cancel(); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    dropPress = cancel;
  }
  // слушатель стоит раньше, чем у OrbitControls: нажатие на деталь выключает вращение до того, как оно началось
  canvas.addEventListener('pointerdown', onPointerDown);

  // ---------- сборка сцены, когда модели загрузились ----------

  function build(loaded) {
    kit = loaded;
    controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.06;
    controls.maxDistance = 1.5;
    controls.rotateSpeed = 0.9;
    controls.zoomSpeed = 0.9;
    // камеру повернули или приблизили — нужен кадр
    controls.addEventListener('change', invalidate);
    // посетитель взял модель рукой: подлёт камеры прекращается
    controls.addEventListener('start', () => { fly.active = false; chase = null; });

    const pack = new THREE.Group();
    pack.add(kit.box, kit.case, kit.glasses, kit.manual, kit.extras);
    for (const o of [kit.box, kit.case, kit.manual, kit.extras]) { o.scale.setScalar(0.0001); o.visible = false; }

    const glassesMeshes = [];
    kit.glasses.traverse((o) => { if (o.isMesh) glassesMeshes.push(o); });

    // свои материалы у деталей, которые светятся (у остальных материалы общие с историей распаковки)
    const own = (root) => {
      const mats = [];
      root.traverse((m) => {
        if (!m.isMesh) return;
        const mat = m.material.clone();
        mat.emissive = new THREE.Color(LIGHT.glow);
        mat.emissiveIntensity = 0;
        m.material = mat;
        mats.push(mat);
      });
      return mats;
    };
    const btn = kit.part('Btn_Capture');
    const pad = kit.part('Touchpad');
    const slider = kit.part('Slider_Power');
    const glow = {
      button: own(btn),
      touchpad: own(pad),
      slider: own(slider),
      camera: own(kit.part('Camera')),
      charge: own(kit.part('Charge_Contacts')),
      led: own(kit.part('Led_Ring')),
    };
    const ledMat = own(kit.part('Led'))[0];
    ledMat.emissive = new THREE.Color(LIGHT.press);

    // щедрые невидимые области нажатия: настоящая кнопка — 10 × 3 мм
    const proxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const proxy = (parent, control, sx, sy, sz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), proxyMat);
      parent.add(m);
      parent.traverse((o) => { o.userData.control = control; });
    };
    proxy(btn, 'button', 0.012, 0.012, 0.02);
    proxy(pad, 'touchpad', 0.008, 0.014, 0.056);
    proxy(slider, 'slider', 0.01, 0.012, 0.018);

    rig = {
      pack, glassesMeshes, glow, ledMat, btn, pad, slider, proxyMat,
      owned: [...Object.values(glow).flat(), ledMat],
      glowColor: new THREE.Color(LIGHT.glow), pressColor: new THREE.Color(LIGHT.press),
      lid: kit.part('Box_Lid'), flap: kit.part('Case_Flap'),
      templeL: kit.part('Temple_L'), templeR: kit.part('Temple_R'),
      btnY: btn.position.y, sliderZ: slider.position.z,
      pois: Object.fromEntries(CONTROLS.map((c) => [c.id, kit.part(c.poi)])),
    };
    scene.add(pack);

    // первый кадр: камера сразу там, где должна быть
    const first = layoutFor('glasses', START_FLAGS);
    camera.position.copy(v3(first.cam.pos));
    controls.target.copy(v3(first.cam.target));
    flyTo(layout.cam.pos, layout.cam.target, layout.cam.wide);
    if (state.selected) flyToSelected();

    // все предметы собираются и уходят в видеокарту до того, как сцена объявлена готовой:
    // переключение предметов потом не дёргается
    void warmUp(gl, scene, camera).then(() => {
      if (disposed) return;
      onReady?.();
      anim.settle = SETTLE_FRAMES;
      invalidate();
    });
  }

  // ---------- один кадр ----------

  function update(delta) {
    // первый кадр после отдыха не должен считать отдых своим временем
    const dt = Math.min(delta, 1 / 20);
    const k = Math.min(1, dt * 6);
    const a = anim;
    const { selected: sel, trial: tr, item: it } = state;
    /** что-то ещё движется: после этого кадра нужен следующий */
    let busy = false;

    if (approach(kit.box, layout.box, k)) busy = true;
    if (approach(kit.case, layout.case, k)) busy = true;
    if (approach(kit.glasses, layout.glasses, k)) busy = true;
    if (approach(kit.manual, layout.manual, k)) busy = true;
    if (approach(kit.extras, layout.extras, k)) busy = true;
    const lidTo = tmp.a.set(layout.lid[0], layout.lid[1], layout.lid[2]);
    if (rig.lid.position.distanceTo(lidTo) > 0.0002) { rig.lid.position.lerp(lidTo, k); busy = true; } else rig.lid.position.copy(lidTo);
    for (const key of ['flap', 'templeL', 'templeR', 'fold']) {
      const e = ease(a[key], layout[key], k, 0.002);
      a[key] = e.value;
      if (e.far) busy = true;
    }
    rig.flap.rotation.x = a.flap;
    rig.templeL.rotation.y = a.templeL;
    rig.templeR.rotation.y = a.templeR;
    foldManual(kit, a.fold);

    // отклик деталей
    const now = clock.elapsedTime;
    const press = tr ? tr.press : a.seen;
    const presses = press.button + press.touchpad;
    if (presses !== a.lastPress) { a.lastPress = presses; a.pressUntil = now + 0.2; }
    if (now < a.pressUntil + 0.05) busy = true;
    // нажатие на модели или в пробе на миг подсвечивает деталь
    for (const id of ['button', 'touchpad', 'slider']) {
      if (press[id] !== a.seen[id]) { a.seen[id] = press[id]; a.pressedAt[id] = now; }
    }
    rig.btn.position.y = rig.btnY - (now < a.pressUntil ? 0.0007 : 0);
    const power = !!tr && tr.power;
    const slide = ease(a.slide, power ? 0.004 : 0, k, 0.00002);
    a.slide = slide.value;
    if (slide.far) busy = true;
    rig.slider.position.z = rig.sliderZ + a.slide;
    // индикатор мигает, пока очки пишут, — единственное здесь, что идёт само
    const recording = !!tr && tr.rec !== 'none';
    if (recording) busy = true;
    rig.ledMat.emissiveIntensity = recording ? 1.2 + Math.sin(now * 8) * 0.8 : power ? 1.6 : 0;
    // выбранная деталь светится ровно ореолом луны; нажатая вспыхивает лунным светом
    for (const c of CONTROLS) {
      const since = c.id === 'button' || c.id === 'touchpad' || c.id === 'slider' ? now - a.pressedAt[c.id] : 1e9;
      const flash = since < PRESS_GLOW ? 1 - since / PRESS_GLOW : 0;
      if (flash > 0) busy = true;
      const lit = Math.max(sel === c.id ? CHOSEN_GLOW : 0, flash * 1.6);
      rig.glow[c.id]?.forEach((m) => {
        m.emissiveIntensity = lit;
        m.emissive.copy(rig.glowColor).lerp(rig.pressColor, Math.min(1, flash * 1.4));
      });
    }

    // камера
    const wall = performance.now();
    if (chase) {
      if (wall > chase.until || sel !== chase.id) chase = null;
      else {
        const view = CONTROLS.find((c) => c.id === chase.id).view;
        fly.target.copy(rig.pois[chase.id].getWorldPosition(tmp.a));
        fly.pos.copy(fly.target).add(tmp.b.set(view[0], view[1], view[2]));
        fly.active = true;
      }
      busy = true;
    }
    if (fly.active) {
      busy = true;
      const kc = Math.min(1, dt * 4.5);
      camera.position.lerp(fly.pos, kc);
      controls.target.lerp(fly.target, kc);
      if (camera.position.distanceTo(fly.pos) < 0.002 && controls.target.distanceTo(fly.target) < 0.002) fly.active = false;
    }
    // с затуханием камера ещё немного плывёт после того, как руку отпустили
    if (controls.update()) busy = true;

    // точки на модели: место каждой детали переводится в координаты экрана
    tmp.frame += 1;
    const visible = it === 'glasses' && kit.glasses.scale.x > 0.9;
    // «точка за оправой?» — луч через всю модель, самое дорогое в этом цикле: по одной точке за раз,
    // по очереди — на каждом третьем кадре, пока модель вращается, и на каждом втором, когда стоит
    const every = busy ? 3 : 2;
    const probe = visible && tmp.frame % every === 0 ? CONTROLS[Math.floor(tmp.frame / every) % CONTROLS.length].id : null;
    for (const c of CONTROLS) {
      const dot = hotspots[c.id];
      if (!dot) continue;
      if (!visible) { dot.style.display = 'none'; continue; }
      const world = rig.pois[c.id].getWorldPosition(tmp.a);
      if (c.id === probe) {
        const dir = tmp.b.copy(world).sub(camera.position);
        const dist = dir.length();
        ray.set(camera.position, dir.normalize());
        ray.far = dist - 0.005;
        tmp.hidden[c.id] = ray.intersectObjects(rig.glassesMeshes, false).length > 0;
      }
      const ndc = world.project(camera);
      if (ndc.z > 1) { dot.style.display = 'none'; continue; }
      dot.style.display = '';
      dot.style.transform = `translate(${((ndc.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-ndc.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`;
      dot.style.opacity = tmp.hidden[c.id] && sel !== c.id ? '0.35' : '1';
    }

    // следующий кадр просим, только пока есть что показать
    if (busy) a.settle = SETTLE_FRAMES;
    else if (a.settle > 0) a.settle -= 1;
    if (busy || a.settle > 0) invalidate();
  }

  // модели общие для страницы: скачиваются один раз, у этой сцены — своя копия дерева
  loadKit().then((loaded) => { if (!disposed) build(loaded); }).catch((err) => console.error(err));

  return {
    set(next) {
      const prev = state;
      state = { ...state, ...next };
      if (state.item !== prev.item || state.flags !== prev.flags) {
        layout = layoutFor(state.item, state.flags);
        if (rig) flyTo(layout.cam.pos, layout.cam.target, layout.cam.wide);
      }
      if (state.selected !== prev.selected && state.selected) flyToSelected();
      anim.settle = SETTLE_FRAMES;
      invalidate();
    },
    setActive(on) {
      if (on === active) return;
      active = on;
      if (!on) { cancelAnimationFrame(raf); raf = 0; return; }
      // время отдыха в часы сцены не идёт
      clock.getDelta();
      anim.settle = SETTLE_FRAMES;
      invalidate();
    },
    zoom(factor) {
      if (!controls) return;
      const dir = camera.position.clone().sub(controls.target);
      const len = THREE.MathUtils.clamp(dir.length() * factor, controls.minDistance, controls.maxDistance);
      flyTo(controls.target.clone().add(dir.setLength(len)), controls.target);
    },
    view(v) {
      if (rig) flyTo(VIEWS[v].pos, VIEWS[v].target, v === 'front' || v === 'top' || v === 'inside' ? 1.0 : 0);
    },
    reset() {
      if (rig) flyTo(layout.cam.pos, layout.cam.target, layout.cam.wide);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      sizes.disconnect();
      dropPress?.();
      Object.values(recognizers).forEach((r) => r.cancel());
      canvas.removeEventListener('pointerdown', onPointerDown);
      controls?.dispose();
      if (rig) {
        scene.remove(rig.pack);
        rig.owned.forEach((m) => m.dispose());
        rig.proxyMat.dispose();
      }
      studio.dispose();
      gl.dispose();
      sky.remove();
      canvas.remove();
    },
  };
}
