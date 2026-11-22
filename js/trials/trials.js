// Общее состояние проб: какая открыта, питание, музыка, звонок, запись и галерея.
// Маленькое хранилище без библиотек: trials.state, trials.items, trials.subscribe(fn).
import { createSynth } from './synth.js';

/** начальное состояние; счётчики shoot / toggle / replay: изменение значит «сделай сейчас» */
const INITIAL = {
  /** открытая проба: 'photo' | 'video' | 'audio' | 'music' | 'assistant' | 'translate' | 'call' | 'power' | null */
  active: null,
  power: false,
  /** идёт запись: 'none' | 'video' | 'audio' */
  rec: 'none',
  /** звонок: 'idle' | 'ringing' | 'talking' | 'ended' */
  call: 'idle',
  music: { playing: false, track: 0, volume: 0.6 },
  shoot: 0,
  toggle: 0,
  replay: 0,
  /** растёт при каждом нажатии детали — для вспышки на 3D-модели */
  press: { button: 0, touchpad: 0, slider: 0 },
};

/**
 * Создать хранилище проб.
 * subscribe(fn) — fn(state, items) зовётся после каждого изменения; возвращает функцию отписки.
 */
export function createTrials() {
  let state = INITIAL;
  let items = [];
  let synthBox = null;
  const listeners = new Set();

  const emit = () => { for (const fn of Array.from(listeners)) fn(state, items); };
  const patch = (p) => { state = { ...state, ...p }; emit(); };
  // синтезатор создаётся при первом звуке: браузер разрешает звук только после действия посетителя
  const synth = () => (synthBox ??= createSynth());

  const syncMusic = () => {
    const s = synth();
    patch({ music: { playing: s.playing, track: s.track, volume: s.volume } });
  };
  const pauseMusic = () => {
    if (synthBox?.playing) { synthBox.pause(); syncMusic(); }
  };

  /** Запустить пробу (кнопка «Попробовать», кнопки в панели пробы, жест на модели). */
  function run(trial) {
    const s = state;
    // уход из пробы с записью заканчивает запись (сам ролик сохраняет проба)
    const leaving = (next) => (s.rec !== 'none' && next !== s.rec ? { rec: 'none' } : {});
    switch (trial) {
      case 'photo':
        if (s.rec !== 'none') return;
        patch({ active: 'photo', shoot: s.shoot + 1, press: { ...s.press, button: s.press.button + 1 } });
        break;
      case 'video':
      case 'audio':
        if (s.rec !== 'none' && s.rec !== trial) return;
        pauseMusic();
        patch({ active: trial, toggle: s.toggle + 1, press: { ...s.press, button: s.press.button + 1 } });
        break;
      case 'music': {
        const m = synth();
        if (m.playing) m.pause(); else m.play();
        patch({ active: 'music', ...leaving('music'), press: { ...s.press, touchpad: s.press.touchpad + 1 }, music: { playing: m.playing, track: m.track, volume: m.volume } });
        break;
      }
      case 'nextTrack': {
        const m = synth();
        m.next();
        m.play();
        patch({ active: 'music', ...leaving('music'), press: { ...s.press, touchpad: s.press.touchpad + 1 }, music: { playing: m.playing, track: m.track, volume: m.volume } });
        break;
      }
      case 'volUp':
      case 'volDown': {
        const m = synth();
        m.setVolume(m.volume + (trial === 'volUp' ? 0.15 : -0.15));
        m.play();
        patch({ active: 'music', ...leaving('music'), press: { ...s.press, touchpad: s.press.touchpad + 1 }, music: { playing: m.playing, track: m.track, volume: m.volume } });
        break;
      }
      case 'assistant':
      case 'translate':
        pauseMusic();
        if (trial === 'assistant') synth().signal('beep');
        // pauseMusic мог уже изменить состояние — музыку берём свежую
        patch({ active: trial, ...leaving(trial), replay: s.replay + 1, press: { ...s.press, touchpad: s.press.touchpad + 1 } });
        break;
      case 'call':
        pauseMusic();
        if (s.call === 'ringing') patch({ active: 'call', call: 'talking', press: { ...s.press, touchpad: s.press.touchpad + 1 } });
        else { synth().signal('ring'); patch({ active: 'call', ...leaving('call'), call: 'ringing' }); }
        break;
      case 'power': {
        const on = !s.power;
        synth().signal(on ? 'on' : 'off');
        patch({ active: 'power', ...leaving('power'), power: on, press: { ...s.press, slider: s.press.slider + 1 } });
        break;
      }
    }
  }

  /** Жест, сделанный прямо на 3D-модели: control — 'button' | 'touchpad' | 'slider'. */
  function gesture(control, g) {
    const s = state;
    if (control === 'slider') return run('power');
    if (control === 'button') {
      if (g === 'tap') return run(s.rec === 'video' ? 'video' : s.rec === 'audio' ? 'audio' : 'photo');
      if (g === 'long' && s.rec === 'none') return run('video');
      if (g === 'double' && s.rec === 'none') return run('audio');
      return;
    }
    if (s.call === 'ringing') {
      if (g === 'double') return run('call');
      if (g === 'long') return patch({ call: 'ended' });
    }
    if (g === 'double') return run('music');
    if (g === 'triple') return run('nextTrack');
    if (g === 'swipeFwd') return run('volUp');
    if (g === 'swipeBack') return run('volDown');
    if (g === 'long') return run('assistant');
  }

  return {
    get state() { return state; },
    get items() { return items; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    run,
    gesture,
    /** закрыть пробу: музыка встаёт на паузу, запись и звонок сбрасываются */
    close() { pauseMusic(); patch({ active: null, rec: 'none', call: 'idle' }); },
    setRec(rec) { patch({ rec }); },
    endCall() { patch({ call: 'ended' }); },
    setVolume(v) { synth().setVolume(v); syncMusic(); },
    /** короткий сигнал: 'on' | 'off' | 'shutter' | 'ring' | 'beep' */
    signal(kind) { synth().signal(kind); },
    /** новый файл встаёт в начало галереи */
    addItem(item) { items = [item, ...items]; emit(); },
    removeItem(id) {
      const hit = items.find((i) => i.id === id);
      // файл жил только в памяти вкладки — освобождаем её
      if (hit?.url.startsWith('blob:')) URL.revokeObjectURL(hit.url);
      items = items.filter((i) => i.id !== id);
      emit();
    },
    /** всё отпустить (страницу закрывают) */
    dispose() {
      synthBox?.dispose();
      items.forEach((i) => i.url.startsWith('blob:') && URL.revokeObjectURL(i.url));
    },
  };
}
