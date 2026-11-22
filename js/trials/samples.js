// Ready-made examples shown when the visitor's camera or microphone cannot be used.
// They are drawn / synthesised in the browser and always carry the word "пример".
import { ru } from '../content/ru.js';
import { litPath } from '../moon/phase.js';
/**
 * A canvas cannot use Tailwind classes, so the colour of a token is read back from its class:
 * the tokens stay defined in one place (tailwind.config.js). The class names are written out in full
 * below so that Tailwind keeps them in the build.
 */
function tokenColor(className) {
    const probe = document.createElement('i');
    probe.className = className;
    probe.hidden = true;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
}
/** A night over the steppe with the moon and the caption: clearly a drawing, not a photo. */
export function sampleImage(label) {
    const c = document.createElement('canvas');
    c.width = 960;
    c.height = 720;
    const g = c.getContext('2d');
    if (!g)
        return '';
    const night = tokenColor('text-bg');
    const moon = tokenColor('text-moon');
    const sky = g.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, night);
    sky.addColorStop(1, tokenColor('text-raised'));
    g.fillStyle = sky;
    g.fillRect(0, 0, 960, 720);
    // a few quiet stars: the same generator idea as the site's sky, fixed so the picture never changes
    g.fillStyle = moon;
    let seed = 7;
    for (let i = 0; i < 46; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const x = (seed / 4294967296) * 960;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const y = (seed / 4294967296) * 470;
        g.globalAlpha = 0.25 + ((i * 37) % 50) / 100;
        g.beginPath();
        g.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
        g.fill();
    }
    g.globalAlpha = 1;
    // the moon: the unlit side barely lighter than the night, the lit part from the shared phase geometry
    g.fillStyle = tokenColor('text-surface');
    g.beginPath();
    g.arc(690, 210, 96, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = moon;
    g.fill(new Path2D(litPath(0.62, 690, 210, 96)));
    // the steppe: a low dark horizon
    g.fillStyle = night;
    g.beginPath();
    g.moveTo(0, 560);
    g.quadraticCurveTo(300, 500, 560, 548);
    g.quadraticCurveTo(780, 588, 960, 532);
    g.lineTo(960, 720);
    g.lineTo(0, 720);
    g.closePath();
    g.fill();
    g.textAlign = 'center';
    g.fillStyle = moon;
    g.font = '700 42px "Manrope Variable", Manrope, "Segoe UI", sans-serif';
    g.fillText(label, 480, 640);
    g.fillStyle = tokenColor('text-halo');
    g.font = '600 26px "Manrope Variable", Manrope, "Segoe UI", sans-serif';
    g.fillText(ru.trials.sampleTag, 480, 684);
    return c.toDataURL('image/jpeg', 0.88);
}
/** A two-second soft chime as a WAV file, returned as a blob: URL. */
export function sampleTone() {
    const rate = 22050;
    const n = rate * 2;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const text = (o, s) => { for (let i = 0; i < s.length; i++)
        v.setUint8(o + i, s.charCodeAt(i)); };
    text(0, 'RIFF');
    v.setUint32(4, 36 + n * 2, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    text(36, 'data');
    v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
        const t = i / rate;
        const f = t < 1 ? 440 : 660;
        const env = Math.exp(-3 * (t % 1));
        v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * f * t) * env * 0.5 * 32767, true);
    }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
