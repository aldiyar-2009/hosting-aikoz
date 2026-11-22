// Панель открытой пробы: фото, видео, диктофон, музыка, ассистент, перевод, звонок, питание.
// Панель встаёт на место карточки детали (см. js/sections/explore.js); смену анимирует общий createSwap.
// Камера, микрофон, запись и звук отпускаются в ту же секунду, когда панель закрыли (release()).
import { ru } from '../content/ru.js';
import { reducedMotion } from '../lib/env.js';
import { el, icon, setChildren } from '../ui/dom.js';
import { appear } from '../ui/motion.js';
import { closeButton, recDot, ringGauge } from '../ui/parts.js';
import { newItem, requestStream, stopStream } from './media.js';
import { sampleImage, sampleTone } from './samples.js';

const t = ru.trials;

/** Виды доступа, с которыми посетитель уже согласился на этой странице: объяснение показываем один раз. */
const explained = new Set();

/** Длительность в виде «м:сс» (или «ч:мм:сс»). */
function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** «готово» — зелёная галочка рядом со словами, никогда не один цвет */
const doneMark = () => icon('check', 17, 'tr-ok');

/** Кнопка-пилюля со значком и текстом; setContent меняет их, не трогая саму кнопку (фокус остаётся). */
function pillButton(className, onClick) {
  const node = el('button', { type: 'button', class: className, onclick: onClick });
  return { el: node, set: (iconNode, text) => setChildren(node, iconNode, text) };
}

/** Объяснение перед запросом браузера: зачем доступ и что файлы никуда не уходят. */
function permissionSheet(kind, onAllow, onCancel) {
  const heading = kind === 'camera' ? t.permission.cameraTitle : kind === 'mic' ? t.permission.micTitle : t.permission.bothTitle;
  return el('div', { class: 'tr-permission' },
    el('p', { class: 'tr-permission-title' }, icon('shield-check', 20, 'tr-halo'), heading),
    el('p', { class: 'tr-text tr-mt-3' }, t.permission.text),
    el('p', { class: 'tr-text tr-mt-2' }, t.permission.privacy),
    el('div', { class: 'tr-row tr-mt-4' },
      el('button', { type: 'button', class: 'btn btn--primary', onclick: onAllow }, t.permission.allow),
      el('button', { type: 'button', class: 'btn btn--secondary', onclick: onCancel }, t.permission.cancel)));
}

/**
 * Камера / микрофон: открываются после того, как посетитель прочитал объяснение.
 * Этапы: 'ask' (показано объяснение) → 'starting' → 'live' или 'failed'.
 * onPhase(phase) зовётся при каждой смене этапа, onFail() — один раз при отказе (тогда показываем пример).
 */
function openStream(kind, fallbackKind, { onPhase, onFail, video }) {
  const s = { phase: explained.has(kind) ? 'starting' : 'ask', reason: 'denied', stream: null };
  let dead = false;

  const setPhase = (phase) => { s.phase = phase; onPhase(phase); };

  async function start() {
    let res = await requestStream(kind);
    if (!res.ok && res.reason === 'nodevice' && fallbackKind) res = await requestStream(fallbackKind);
    // панель закрыли, пока браузер спрашивал: поток сразу отпускаем
    if (dead) { if (res.ok) stopStream(res.stream); return; }
    if (!res.ok) { s.reason = res.reason; setPhase('failed'); onFail(); return; }
    s.stream = res.stream;
    if (video) {
      video.srcObject = res.stream;
      await video.play().catch(() => undefined);
      if (dead) return;
    }
    setPhase('live');
  }

  s.allow = () => { explained.add(kind); setPhase('starting'); void start(); };
  /** отпустить камеру и микрофон */
  s.release = () => { dead = true; stopStream(s.stream); };
  /** запустить, если объяснение уже было показано раньше */
  s.begin = () => { if (s.phase === 'starting') void start(); };
  return s;
}

/**
 * Картинка с камеры. Рамка стоит с момента запроса камеры, поэтому панель не меняет высоту,
 * когда картинка приходит: она только проявляется.
 */
function preview() {
  const video = el('video', { class: 'tr-video', playsinline: true });
  video.muted = true;
  const wait = el('span', { class: 'tr-preview-wait' }, icon('camera', 28));
  const box = el('div', { class: 'inset tr-preview', hidden: true }, video, wait);
  const setPhase = (phase) => {
    const live = phase === 'live';
    box.hidden = !(live || phase === 'starting');
    video.classList.toggle('is-live', live);
    wait.hidden = live;
  };
  return { el: box, video, setPhase };
}

// ---------- фото ----------

function photoTrial(trials) {
  let handled = 0;
  let count = 0;
  let released = false;
  let flashTimer;

  const view = preview();
  const flash = el('div', { class: 'tr-flash', hidden: true });
  view.el.append(flash);
  const ask = el('div');
  const denied = el('p', { class: 'tr-denied', hidden: true });
  const doneText = el('p', { class: 'tr-done', hidden: true }, doneMark(), t.photo.done);
  const controls = el('div', { class: 'tr-row tr-row--center tr-row--gap3 tr-min44', hidden: true },
    el('button', { type: 'button', class: 'btn btn--primary', onclick: () => trials.run('photo') }, icon('camera', 16), t.photo.shoot),
    doneText);
  const body = el('div', { class: 'tr-stack' }, ask, denied, view.el, controls);

  const stream = openStream('camera', null, {
    video: view.video,
    onFail: () => trials.addItem(newItem('photo', sampleImage(t.photo.sample), true, t.photo.sample)),
    onPhase: (phase) => { renderPhase(phase); check(); },
  });

  function renderPhase(phase) {
    if (released) return;
    ask.hidden = phase !== 'ask';
    denied.hidden = phase !== 'failed';
    if (phase === 'failed') denied.textContent = t.denied[stream.reason];
    view.setPhase(phase);
    controls.hidden = phase !== 'live';
  }

  /** счётчик «снять» вырос, а камера готова — делаем снимок */
  function check() {
    const { shoot } = trials.state;
    if (released || stream.phase !== 'live' || shoot <= handled) return;
    handled = shoot;
    let tries = 0;
    const capture = () => {
      if (released) return;
      const v = view.video;
      // камера ещё не отдала первый кадр — подождём немного
      if (!v.videoWidth && tries++ < 20) { setTimeout(capture, 120); return; }
      const c = document.createElement('canvas');
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (!blob) return;
        trials.addItem(newItem('photo', URL.createObjectURL(blob)));
        trials.signal('shutter');
        if (released) return;
        count += 1;
        doneText.hidden = count === 0;
        flash.hidden = false;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash.hidden = true; }, 180);
      }, 'image/jpeg', 0.9);
    };
    capture();
  }

  ask.append(permissionSheet('camera', stream.allow, trials.close));
  renderPhase(stream.phase);
  stream.begin();

  return {
    el: body,
    update: check,
    setAwake() {},
    release() { released = true; clearTimeout(flashTimer); stream.release(); },
  };
}

// ---------- видео и диктофон ----------

function recorderTrial(trials, mode, awakeAtStart) {
  const copy = mode === 'video' ? t.video : t.audio;
  const limitMs = (mode === 'video' ? 10 : 15) * 1000;
  let handled = 0;
  let recorder = null;
  let stopTimer;
  /** когда началась запись; null — ничего не пишется */
  let since = null;
  let saved = 0;
  let unsupported = false;
  let released = false;
  let awake = awakeAtStart;
  let clock;
  let meter = null;

  const view = mode === 'video' ? preview() : null;
  const ask = el('div');
  const denied = el('p', { class: 'tr-denied', hidden: true });
  const noRecorder = el('p', { class: 'tr-denied', hidden: true }, t.denied.unsupported);

  // видео: метка времени поверх картинки
  const overDot = recDot();
  const overTime = el('span', { class: 'tr-nums' });
  const over = el('span', { class: 'label tr-rec-label', hidden: true }, overDot.el, overTime);
  view?.el.append(over);

  // диктофон: столбики уровня (меняется только transform)
  const bars = mode === 'audio'
    ? el('div', { class: 'inset tr-bars', 'aria-hidden': 'true', hidden: true },
      Array.from({ length: 24 }, () => el('span', { class: 'tr-bar', style: { transform: 'scaleY(.12)' } })))
    : null;

  // кнопка держит ширину, показание — свою строку: старт и стоп записи ничего не сдвигают
  const button = pillButton('btn btn--primary tr-rec-button', () => trials.run(mode));
  const gauge = ringGauge(0, 'mic');
  const lineDot = recDot();
  const lineTime = el('span', { class: 'tr-nums' });
  const lineRec = el('span', { class: 'tr-status tr-status--bold', hidden: true }, lineDot.el, el('span', {}, `${copy.recording}, `, lineTime));
  const lineDone = el('span', { class: 'tr-status', hidden: true }, doneMark(), copy.done);
  const lineLimit = el('span', {}, copy.limit);
  const controls = el('div', { class: 'tr-rec-controls', hidden: true },
    button.el,
    el('div', { class: 'tr-rec-gauge' }, gauge.el, el('p', { class: 'tr-rec-text', 'aria-live': 'polite' }, lineRec, lineDone, lineLimit)));

  const body = el('div', { class: 'tr-stack' }, ask, denied, noRecorder, view?.el ?? bars, controls);

  const addSample = () => {
    if (mode === 'video') trials.addItem(newItem('photo', sampleImage(copy.sample), true, copy.sample));
    else trials.addItem(newItem('audio', sampleTone(), true, copy.sample));
  };

  const stream = openStream(mode === 'video' ? 'both' : 'mic', mode === 'video' ? 'camera' : null, {
    video: view?.video,
    onFail: addSample,
    onPhase: () => { render(); syncMeter(); check(); },
  });

  /** время записи: не больше предела */
  const elapsed = () => Math.min(limitMs, Math.max(0, Date.now() - since));

  function tick() {
    if (released || since === null) return;
    const text = formatDuration(elapsed());
    overTime.textContent = text;
    lineTime.textContent = text;
    // кольцо двигается раз в секунду, вместе с числом рядом
    gauge.setLevel((Math.floor(elapsed() / 1000) * 1000) / limitMs);
  }

  /** таймер тикает, только пока идёт запись и раздел виден */
  function syncClock() {
    clearInterval(clock);
    clock = undefined;
    const on = !released && awake && since !== null;
    overDot.setAwake(on);
    lineDot.setAwake(on);
    if (on) { tick(); clock = setInterval(tick, 250); }
  }

  function render() {
    if (released) return;
    const { phase } = stream;
    const recording = since !== null;
    ask.hidden = phase !== 'ask';
    denied.hidden = phase !== 'failed';
    if (phase === 'failed') denied.textContent = t.denied[stream.reason];
    noRecorder.hidden = !unsupported;
    view?.setPhase(phase);
    over.hidden = !recording;
    if (bars) {
      bars.hidden = !(phase === 'live' || phase === 'starting');
      bars.classList.toggle('is-rec', recording);
    }
    controls.hidden = !(phase === 'live' && !unsupported);
    button.el.className = `btn ${recording ? 'btn--stop' : 'btn--primary'} tr-rec-button`;
    button.set(recording ? icon('square', 15) : icon(mode === 'video' ? 'camera' : 'mic', 16), recording ? copy.stop : copy.start);
    lineRec.hidden = !recording;
    lineDone.hidden = recording || saved === 0;
    lineLimit.className = recording || saved > 0 ? 'caption tr-block' : 'tr-muted';
    if (!recording) gauge.setLevel(0);
    syncClock();
  }

  function stop() {
    clearTimeout(stopTimer);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function start() {
    const s = stream.stream;
    if (!s) return;
    if (typeof MediaRecorder === 'undefined') { unsupported = true; addSample(); render(); return; }
    const chunks = [];
    const rec = new MediaRecorder(s);
    recorder = rec;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      since = null;
      // панель уже закрыта: общее состояние сбросила она сама, здесь только сохраняем ролик
      if (!released) trials.setRec('none');
      if (chunks.length) {
        const blob = new Blob(chunks, { type: rec.mimeType || (mode === 'video' ? 'video/webm' : 'audio/webm') });
        trials.addItem(newItem(mode, URL.createObjectURL(blob)));
        saved += 1;
      }
      render();
    };
    rec.start();
    since = Date.now();
    render();
    trials.setRec(mode);
    stopTimer = setTimeout(stop, limitMs);
  }

  /** счётчик «переключить» вырос — начинаем или останавливаем запись */
  function check() {
    const { toggle } = trials.state;
    if (released || stream.phase !== 'live' || toggle <= handled) return;
    handled = toggle;
    if (recorder && recorder.state === 'recording') stop(); else start();
  }

  /** уровень звука для диктофона: работает, только пока панель видна */
  function syncMeter() {
    const want = !released && mode === 'audio' && stream.phase === 'live' && awake && !!stream.stream;
    if (want === !!meter) return;
    if (!want) {
      cancelAnimationFrame(meter.raf);
      void meter.ctx.close();
      meter = null;
      return;
    }
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    ctx.createMediaStreamSource(stream.stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const mine = { ctx, raf: 0 };
    meter = mine;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const els = bars.children;
      for (let i = 0; i < els.length; i++) els[i].style.transform = `scaleY(${(0.12 + (data[i + 1] / 255) * 0.88).toFixed(3)})`;
      mine.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  ask.append(permissionSheet(mode === 'video' ? 'both' : 'mic', stream.allow, trials.close));
  render();
  stream.begin();

  return {
    el: body,
    update: check,
    setAwake(on) { awake = on; syncClock(); syncMeter(); },
    // закрытие панели сразу заканчивает запись (ролик сохраняется), затем отпускает камеру и микрофон
    release() {
      stop();
      released = true;
      clearTimeout(stopTimer);
      syncClock();
      syncMeter();
      stream.release();
    },
  };
}

// ---------- музыка ----------

function musicTrial(trials) {
  const disc = el('div', { class: 'tr-music-disc' }, icon('music', 22));
  const title = el('p', { class: 'tr-music-title' });
  const status = el('p', { class: 'tr-music-status', 'aria-live': 'polite' });
  const play = pillButton('btn btn--primary tr-play-button', () => trials.run('music'));
  // громкость — кольцом вокруг значка динамика; число всегда рядом
  const gauge = ringGauge(0, 'volume-2');
  const percent = el('span', { class: 'tr-volume-number' });
  const range = el('input', { type: 'range', min: 0, max: 1, step: 0.05, class: 'tr-range' });
  range.addEventListener('input', () => trials.setVolume(Number(range.value)));

  const body = el('div', { class: 'tr-stack tr-stack--4' },
    el('p', { class: 'tr-text' }, t.music.text),
    el('div', { class: 'inset tr-music-card' }, disc, el('div', { class: 'tr-min0' }, title, status)),
    el('div', { class: 'tr-row' },
      play.el,
      el('button', { type: 'button', class: 'btn btn--secondary', onclick: () => trials.run('nextTrack') }, icon('skip-forward', 16), t.music.next)),
    el('div', { class: 'tr-volume' },
      gauge.el,
      el('label', { class: 'tr-volume-label' },
        el('span', { class: 'tr-volume-head' }, t.music.volume, percent),
        // слабая линия под дорожкой: ползунок виден, даже если браузер не покрасил дорожку
        el('span', { class: 'tr-range-box' }, el('span', { class: 'tr-range-line', 'aria-hidden': 'true' }), range))));

  let wasPlaying = null;
  function update(state) {
    const m = state.music;
    disc.classList.toggle('is-on', m.playing);
    title.textContent = t.music.tracks[m.track % t.music.tracks.length];
    status.textContent = m.playing ? t.music.playing : t.music.paused;
    status.classList.toggle('is-on', m.playing);
    if (wasPlaying !== m.playing) {
      wasPlaying = m.playing;
      play.set(icon(m.playing ? 'pause' : 'play', 16), m.playing ? t.music.pause : t.music.play);
    }
    gauge.setLevel(m.volume);
    percent.textContent = `${Math.round(m.volume * 100)} %`;
    if (Number(range.value) !== m.volume) range.value = String(m.volume);
  }
  update(trials.state);
  return { el: body, update, setAwake() {}, release() {} };
}

// ---------- записанный диалог: ассистент и перевод ----------

function dialogTrial(trials, lines, note, heard, awakeAtStart) {
  let awake = awakeAtStart;
  let released = false;
  let shown = 0;
  let replay = trials.state.replay;
  let timer;

  const list = el('div', { class: 'tr-lines', 'aria-live': 'polite' });
  const body = el('div', { class: 'tr-stack' },
    el('p', { class: 'tr-note' }, el('span', { class: 'chip tr-note-chip' }, t.sampleTag), note),
    list);

  function addLine(l) {
    const bubble = el('div', { class: `tr-bubble ${l.who === 'me' ? 'bubble-me' : 'bubble-them'}` },
      l.original && el('p', { class: 'caption' }, l.original),
      el('p', { class: 'tr-bubble-text' }, l.text),
      heard && l.who !== 'me' && el('p', { class: 'tr-heard' }, heard));
    list.append(el('div', { class: `tr-line ${l.who === 'me' ? 'tr-line--me' : ''}` }, bubble));
    // новая реплика приходит снизу (с «меньше движения» — только проявляется)
    appear(bubble);
  }

  /** следующая реплика — после паузы; когда показаны все или раздел не виден, таймер не идёт */
  function schedule() {
    clearTimeout(timer);
    if (released || !awake || shown >= lines.length) return;
    timer = setTimeout(() => { addLine(lines[shown]); shown += 1; schedule(); }, 1500);
  }

  function reset() {
    list.replaceChildren();
    // «меньше движения»: весь диалог сразу
    const first = reducedMotion() ? lines.length : 1;
    for (shown = 0; shown < first; shown++) addLine(lines[shown]);
    schedule();
  }
  reset();

  return {
    el: body,
    // повторный жест проигрывает диалог с начала
    update(state) { if (state.replay !== replay) { replay = state.replay; reset(); } },
    setAwake(on) { awake = on; schedule(); },
    release() { released = true; clearTimeout(timer); },
  };
}

// ---------- звонок ----------

function callTrial(trials, awakeAtStart) {
  let awake = awakeAtStart;
  let released = false;
  let call = null;
  let since = null;
  let ringTimer;
  let clock;

  const ring = el('div', { class: 'tr-call-ring' });
  const status = el('p', { class: 'tr-call-status', 'aria-live': 'polite' });
  const hint = el('p', { class: 'caption', hidden: true }, t.call.hint);
  const time = el('span', { class: 'tr-call-time', hidden: true });
  const answer = el('button', { type: 'button', class: 'btn btn--primary', onclick: () => trials.run('call') }, icon('phone', 16), t.call.answer);
  const end = el('button', { type: 'button', class: 'btn btn--secondary', onclick: () => trials.endCall() }, icon('phone-off', 16), t.call.end);
  const again = el('button', { type: 'button', class: 'btn btn--primary', onclick: () => trials.run('call') }, t.call.again);

  const body = el('div', { class: 'tr-stack tr-call' },
    el('p', { class: 'tr-note tr-note--center' }, el('span', { class: 'chip' }, t.sampleTag), t.call.note),
    ring,
    el('div', {}, el('p', { class: 'h3' }, t.call.name), status),
    // строка постоянной высоты под подсказку или таймер: кнопки ниже не двигаются
    el('div', { class: 'tr-call-line' }, hint, time),
    el('div', { class: 'tr-row tr-row--middle tr-min44' }, answer, end, again));

  const tick = () => { if (since !== null) time.textContent = formatDuration(Date.now() - since); };

  /** гудок повторяется и таймер идёт, только пока страница перед посетителем */
  function syncTimers() {
    clearInterval(ringTimer);
    clearInterval(clock);
    ringTimer = clock = undefined;
    if (released || !awake) return;
    if (call === 'ringing') ringTimer = setInterval(() => trials.signal('ring'), 2200);
    if (call === 'talking') { tick(); clock = setInterval(tick, 250); }
  }

  function update(state) {
    if (released || state.call === call) return;
    call = state.call;
    since = call === 'talking' ? Date.now() : null;
    // состояние говорят значок и слова под именем; цвет только поддерживает их
    ring.className = `tr-call-ring ${call === 'ringing' ? 'is-ringing' : call === 'talking' ? 'is-talking' : ''}`;
    setChildren(ring, icon(call === 'ringing' ? 'phone-incoming' : call === 'talking' ? 'phone' : 'phone-off', 28));
    status.textContent = call === 'ringing' ? t.call.incoming : call === 'talking' ? t.call.talking : t.call.ended;
    hint.hidden = call !== 'ringing';
    time.hidden = call !== 'talking';
    // фокус не должен пропасть вместе со спрятанной кнопкой
    const focused = document.activeElement;
    answer.hidden = call !== 'ringing';
    end.hidden = !(call === 'ringing' || call === 'talking');
    again.hidden = !(call === 'ended' || call === 'idle');
    if (focused && body.contains(focused) && focused.hidden) [answer, end, again].find((b) => !b.hidden)?.focus({ preventScroll: true });
    syncTimers();
  }
  update(trials.state);

  return {
    el: body,
    update,
    setAwake(on) { awake = on; syncTimers(); },
    release() { released = true; syncTimers(); },
  };
}

// ---------- питание ----------

function powerTrial(trials) {
  const mark = icon('power', 20, 'tr-power-icon');
  const text = el('p', { class: 'tr-power-text', 'aria-live': 'polite' });
  const button = el('button', { type: 'button', class: 'btn btn--primary tr-power-button', onclick: () => trials.run('power') });
  const body = el('div', { class: 'tr-stack' },
    el('div', { class: 'inset tr-power-card' }, mark, text),
    el('p', { class: 'tr-text' }, t.power.text),
    button);
  function update(state) {
    const on = state.power;
    mark.classList.toggle('is-on', on);
    text.textContent = on ? t.power.on : t.power.off;
    button.textContent = on ? t.power.turnOff : t.power.turnOn;
  }
  update(trials.state);
  return { el: body, update, setAwake() {}, release() {} };
}

const TITLES = {
  photo: t.photo.title, video: t.video.title, audio: t.audio.title, music: t.music.title,
  assistant: t.assistant.title, translate: t.translate.title, call: t.call.title, power: t.power.title,
};

/**
 * Панель пробы `active`. Возвращает:
 *   el            — готовая панель;
 *   update(state) — состояние проб изменилось;
 *   setAwake(on)  — раздел виден / не виден: таймеры и анимации отдыхают вне экрана;
 *   release()     — панель закрыта: камера, микрофон, запись и таймеры отпускаются сразу.
 */
export function createTrialPanel(trials, active, awake = true) {
  const trial =
    active === 'photo' ? photoTrial(trials)
      : active === 'video' || active === 'audio' ? recorderTrial(trials, active, awake)
        : active === 'music' ? musicTrial(trials)
          : active === 'assistant' ? dialogTrial(trials, t.assistant.lines, t.assistant.note, undefined, awake)
            : active === 'translate' ? dialogTrial(trials, t.translate.lines, t.translate.note, t.translate.heard, awake)
              : active === 'call' ? callTrial(trials, awake)
                : powerTrial(trials);
  const panel = el('section', { class: 'panel', 'aria-label': TITLES[active] },
    el('header', { class: 'tr-header' },
      el('h3', { class: 'h3' }, TITLES[active]),
      closeButton(t.close, () => trials.close())),
    trial.el);
  return { el: panel, update: trial.update, setAwake: trial.setAwake, release: trial.release };
}
