// Tiny music box on Web Audio: three own loops and a few signals.
// No recorded music is used, so there is nothing to license.
// notes are semitones from A3 (220 Hz); -99 = rest
const TRACKS = [
    { tempo: 96, wave: 'triangle', notes: [0, 7, 12, 7, 3, 7, 10, 7, 5, 9, 12, 9, 3, 7, 10, 14], bass: [-12, -12, -9, -9, -7, -7, -9, -9] },
    { tempo: 118, wave: 'sawtooth', notes: [0, -99, 3, 7, -99, 10, 7, 3, -2, -99, 2, 5, -99, 8, 5, 2], bass: [-12, -12, -12, -12, -14, -14, -14, -14] },
    { tempo: 84, wave: 'sine', notes: [12, 10, 7, 5, 7, 10, 12, 15, 14, 12, 10, 7, 5, 7, 3, 5], bass: [-5, -5, -9, -9, -12, -12, -7, -7] },
];
const freq = (semi) => 220 * 2 ** (semi / 12);
export function createSynth() {
    let ctx = null;
    let master = null;
    let timer;
    let step = 0;
    let nextTime = 0;
    let track = 0;
    let volume = 0.6;
    let playing = false;
    const ensure = () => {
        if (!ctx) {
            const Ctor = window.AudioContext ?? window.webkitAudioContext;
            ctx = new Ctor();
            master = ctx.createGain();
            master.gain.value = volume * 0.35;
            master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended')
            void ctx.resume();
        return ctx;
    };
    const blip = (f, at, dur, wave, gain) => {
        if (!ctx || !master)
            return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = wave;
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(g).connect(master);
        osc.start(at);
        osc.stop(at + dur + 0.05);
    };
    const schedule = () => {
        if (!ctx)
            return;
        const t = TRACKS[track];
        const beat = 60 / t.tempo / 2;
        while (nextTime < ctx.currentTime + 0.25) {
            const n = t.notes[step % t.notes.length];
            if (n !== -99)
                blip(freq(n), nextTime, beat * 1.6, t.wave, t.wave === 'sawtooth' ? 0.25 : 0.5);
            if (step % 2 === 0)
                blip(freq(t.bass[(step / 2) % t.bass.length]), nextTime, beat * 2.2, 'sine', 0.6);
            step += 1;
            nextTime += beat;
        }
    };
    const stopTimer = () => { clearInterval(timer); timer = undefined; };
    return {
        get playing() { return playing; },
        get track() { return track; },
        get volume() { return volume; },
        trackCount: TRACKS.length,
        play() {
            const c = ensure();
            if (playing)
                return;
            playing = true;
            nextTime = c.currentTime + 0.06;
            schedule();
            timer = setInterval(schedule, 80);
        },
        pause() { playing = false; stopTimer(); },
        next() {
            track = (track + 1) % TRACKS.length;
            step = 0;
            if (ctx)
                nextTime = ctx.currentTime + 0.06;
        },
        setVolume(v) {
            volume = Math.min(1, Math.max(0, v));
            if (master && ctx)
                master.gain.setTargetAtTime(volume * 0.35, ctx.currentTime, 0.03);
        },
        /** short signals: power on / off, shutter, ring */
        signal(kind) {
            const c = ensure();
            const now = c.currentTime + 0.01;
            if (kind === 'on') {
                blip(freq(12), now, 0.12, 'sine', 0.6);
                blip(freq(19), now + 0.12, 0.2, 'sine', 0.6);
            }
            if (kind === 'off') {
                blip(freq(19), now, 0.12, 'sine', 0.6);
                blip(freq(12), now + 0.12, 0.2, 'sine', 0.6);
            }
            if (kind === 'shutter') {
                blip(1800, now, 0.04, 'square', 0.25);
                blip(1200, now + 0.05, 0.05, 'square', 0.2);
            }
            if (kind === 'beep')
                blip(freq(24), now, 0.1, 'sine', 0.5);
            if (kind === 'ring')
                for (let i = 0; i < 2; i++) {
                    blip(freq(17), now + i * 0.22, 0.16, 'triangle', 0.6);
                    blip(freq(21), now + i * 0.22 + 0.08, 0.14, 'triangle', 0.5);
                }
        },
        dispose() {
            stopTimer();
            playing = false;
            void ctx?.close();
            ctx = null;
            master = null;
        },
    };
}
