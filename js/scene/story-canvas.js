// 3D-сцена истории распаковки: свой рендерер three.js, камера, свет и цикл кадров.
// Кадр рисуется ТОЛЬКО пока история движется (прокрутка, смена размера окна, возврат на экран).
// Сцена стоит — видеокарта отдыхает; вне экрана и на скрытой вкладке ничего не рисуется.
//
// createStoryCanvas(holder, { getProgress, onReady, onFrame, onError }) → { wake(), setActive(on), destroy() }
//   holder       — элемент, в который встаёт <canvas> (занимает его целиком);
//   getProgress  — функция: ход истории 0..1 (куда докрутил посетитель);
//   onReady      — модели скачаны, шейдеры собраны: сцену можно показывать;
//   onFrame(p)   — вызывается на каждом нарисованном кадре со сглаженным ходом: страница двигает луну тем же циклом;
//   onError(e)   — модели не скачались;
//   wake()       — попросить кадр (страница зовёт при прокрутке);
//   setActive(on)— история на экране или нет: вне экрана кадры не рисуются;
//   destroy()    — остановить всё и освободить видеопамять.

import * as THREE from '../../vendor/three.module.min.js';
import { reducedMotion } from '../lib/env.js';
import { createRenderer, createStudio, foldManual, loadKit, pixelRatio, warmUp } from './models.js';
import { poseAt } from './timeline.js';

const CAMERA_Z = 0.62;
const FOV = 32;
/** высота того, что видит камера в центре сцены, в метрах */
const VISIBLE_HEIGHT = 2 * CAMERA_Z * Math.tan((FOV / 2) * (Math.PI / 180));
/**
 * Где стоит композиция на экране: доля высоты от верха. Луна стоит там же (.story-moon в css/story.css):
 * чуть выше середины, а на вертикальных экранах ещё выше — там низ занимает подпись.
 */
const CENTRE = { wide: 0.47, upright: 0.42 };

/** как быстро сцена и луна догоняют прокрутку, 1/с: постоянная времени 1/8 с = 125 мс */
const FOLLOW = 8;

/** Поставить объект в позу из таймлайна. */
function apply(o, pose) {
  o.position.set(pose.position[0], pose.position[1], pose.position[2]);
  o.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
  o.scale.setScalar(pose.scale);
  o.visible = pose.visible;
}

export function createStoryCanvas(holder, { getProgress, onReady, onFrame, onError } = {}) {
  // ---- рендерер, сцена, камера ----
  const gl = createRenderer();
  const canvas = gl.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  holder.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 10);
  camera.position.set(0, 0, CAMERA_Z);
  const studio = createStudio(gl, scene);

  const size = { width: 1, height: 1 };
  let dead = false;
  let active = false;
  /** номер заказанного кадра (0 — кадр не заказан) */
  let raf = 0;
  /** время прошлого кадра, мс */
  let last = 0;
  /** модели и их подвижные части; появляются, когда файлы скачаны */
  let kit = null;
  let rig = null;
  let smooth = 0;

  // ---- кадры по требованию ----
  /** Попросить один кадр. Вне экрана просьба не выполняется: кадр нарисуется при возврате. */
  function invalidate() {
    if (dead || !active || raf) return;
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    raf = 0;
    if (dead || !active) return;
    const delta = last ? (now - last) / 1000 : 0;
    last = now;
    frame(delta);
  }

  /** Один кадр: догнать прокрутку, расставить части, нарисовать. */
  function frame(delta) {
    if (!rig) return;
    // сцена идёт за прокруткой плавно (отставание около 120 мс), но не отстаёт далеко при быстрой прокрутке;
    // первый кадр после покоя не должен считать время покоя своим
    const dt = Math.min(delta, 1 / 30);
    const target = getProgress();
    smooth += (target - smooth) * (reducedMotion() ? 1 : Math.min(1, dt * FOLLOW));
    if (Math.abs(target - smooth) < 0.0004) smooth = target;
    // ещё в пути: нужен следующий кадр
    if (smooth !== target) invalidate();
    const f = poseAt(smooth);
    apply(rig.pack, f.parts.pack);
    apply(rig.lid, f.parts.boxLid);
    apply(rig.base, f.parts.boxBase);
    apply(kit.manual, f.parts.manual);
    apply(kit.case, f.parts.case);
    apply(kit.glasses, f.parts.glasses);
    rig.flap.rotation.x = f.angles.flap;
    rig.templeL.rotation.y = f.angles.templeL;
    rig.templeR.rotation.y = f.angles.templeR;
    foldManual(kit, f.angles.manualFold);
    // узкие экраны: композиция уменьшается, чтобы ничего не обрезалось
    const aspect = size.width / Math.max(size.height, 1);
    rig.fit.scale.setScalar(Math.min(1, aspect * 0.95));
    const centre = aspect < 0.8 ? CENTRE.upright : CENTRE.wide;
    rig.fit.position.y = (0.5 - centre) * VISIBLE_HEIGHT;
    onFrame?.(smooth);
    gl.render(scene, camera);
  }

  // ---- размер: холст всегда во весь блок ----
  function resize() {
    const w = holder.clientWidth;
    const h = holder.clientHeight;
    if (dead || w === 0 || h === 0) return;
    size.width = w;
    size.height = h;
    gl.setPixelRatio(pixelRatio());
    gl.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // смена размера стирает холст: рисуем сразу, не дожидаясь следующего кадра
    if (active && rig) frame(0);
    else invalidate();
  }
  const sizes = new ResizeObserver(resize);
  sizes.observe(holder);
  resize();

  // ---- модели ----
  loadKit().then(async (loaded) => {
    if (dead) return;
    kit = loaded;
    const fit = new THREE.Group();
    const pack = new THREE.Group();
    fit.add(pack);
    pack.add(kit.box, kit.case, kit.glasses, kit.manual);
    // коробочка с кабелем лежит на дне коробки и ездит вместе с ним
    const base = kit.part('Box_Base');
    kit.extras.scale.setScalar(1);
    kit.extras.position.set(0, 0, 0);
    base.add(kit.extras);
    smooth = getProgress();
    rig = {
      fit, pack,
      lid: kit.part('Box_Lid'), base,
      flap: kit.part('Case_Flap'),
      templeL: kit.part('Temple_L'), templeR: kit.part('Temple_R'),
    };
    scene.add(fit);
    // сцену показываем, только когда каждая деталь собрана и загружена в видеокарту: без рывка посреди истории
    await warmUp(gl, scene, camera);
    if (dead) return;
    onReady?.();
    // после подготовки на холсте кадр «всё видно сразу»: рисуем настоящий, даже если история пока вне экрана
    frame(0);
    invalidate();
  }).catch((e) => {
    if (dead) return;
    console.error(e);
    onError?.(e);
  });

  return {
    wake: invalidate,
    /** История пришла на экран или ушла с него. */
    setActive(on) {
      if (dead || on === active) return;
      active = on;
      if (active) {
        // время, проведённое вне экрана, в движение не идёт
        last = 0;
        invalidate();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    destroy() {
      if (dead) return;
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      sizes.disconnect();
      studio.dispose();
      gl.dispose();
      canvas.remove();
    },
  };
}
