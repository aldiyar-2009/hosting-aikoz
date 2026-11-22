// The unboxing story as a pure function of scroll progress (0..1).
// Positions are metres in three.js axes (+Y up, +Z towards the viewer), relative to the centre of the stage.
// Parts live inside "pack", so pack's rotation tilts the whole composition.
// `rest`: the progress at which the scene shows its finished picture - where a jump to the scene lands.
export const SCENES = [
    { id: 'box', from: 0.0, to: 0.12, rest: 0.03 },
    { id: 'open', from: 0.12, to: 0.3, rest: 0.26 },
    { id: 'case', from: 0.3, to: 0.5, rest: 0.49 },
    { id: 'inside', from: 0.5, to: 0.7, rest: 0.64 },
    { id: 'glasses', from: 0.7, to: 0.86, rest: 0.855 },
    { id: 'explore', from: 0.86, to: 1.0, rest: 0.95 },
];
export function sceneIndexAt(progress) {
    const p = clamp01(progress);
    const i = SCENES.findIndex((s) => p < s.to);
    return i === -1 ? SCENES.length - 1 : i;
}
const DEG = Math.PI / 180;
const BOX_H = 0.06;
const BOX_Y = -BOX_H / 2; // box models have their origin on the bottom
const CASE_IN_BOX = [-0.01335, BOX_Y + 0.0021 + 0.0275, 0.0491];
const CASE_SCALE = 1.5;
const CASE_UP = [0, -0.0275 * CASE_SCALE, 0];
/** Where the folded glasses stand inside the case (Case_GlassesSlot), in case space. */
export const SLOT = [0, 0.02702, 0.0024];
const GLASSES_IN_CASE = [0, CASE_UP[1] + SLOT[1] * CASE_SCALE, SLOT[2] * CASE_SCALE];
export const TEMPLE_L_FOLDED = 90 * DEG;
export const TEMPLE_R_FOLDED = -83 * DEG;
export const FLAP_OPEN = -137 * DEG;
export const MANUAL_FOLDED = 177 * DEG;
const TRACKS = {
    pack: [
        { t: 0.0, p: [0, 0, 0], r: [0.5, -0.6, 0], s: 0.98 },
        { t: 0.12, p: [0, 0, 0], r: [0.6, -0.3, 0], s: 0.98 },
        { t: 0.3, p: [0, -0.01, 0], r: [0.8, 0, 0], s: 0.95 },
        { t: 0.5, p: [0, 0, 0], r: [0.12, -0.38, 0], s: 1 },
        { t: 0.62, p: [0, -0.05, 0], r: [0.3, 0, 0], s: 1 },
        { t: 0.86, p: [0, 0, 0], r: [0, 0, 0], s: 1 },
        { t: 1.0, p: [0, 0, 0], r: [0, 0, 0], s: 1 },
    ],
    boxLid: [
        { t: 0.0, p: [0, BOX_Y, 0], r: [0, 0, 0], s: 1, v: true },
        { t: 0.12, p: [0, BOX_Y, 0], r: [0, 0, 0], s: 1 },
        { t: 0.22, p: [0, BOX_Y + 0.15, -0.02], r: [-0.25, 0, 0], s: 1 },
        { t: 0.28, p: [0, BOX_Y + 0.5, -0.1], r: [-0.5, 0, 0], s: 1 },
        { t: 0.285, p: [0, BOX_Y + 0.5, -0.1], r: [-0.5, 0, 0], s: 1, v: false },
    ],
    boxBase: [
        { t: 0.0, p: [0, BOX_Y, 0], r: [0, 0, 0], s: 1, v: true },
        { t: 0.32, p: [0, BOX_Y, 0], r: [0, 0, 0], s: 1 },
        { t: 0.46, p: [0, BOX_Y - 0.5, 0], r: [0, 0, 0], s: 1 },
        { t: 0.465, p: [0, BOX_Y - 0.5, 0], r: [0, 0, 0], s: 1, v: false },
    ],
    manual: [
        { t: 0.0, p: [-0.01335, BOX_Y + 0.0428, -0.0557], r: [0, 0, 0], s: 1, v: false },
        { t: 0.13, p: [-0.01335, BOX_Y + 0.0428, -0.0557], r: [0, 0, 0], s: 1, v: true },
        { t: 0.16, p: [-0.01335, BOX_Y + 0.0428, -0.0557], r: [0, 0, 0], s: 1 },
        { t: 0.25, p: [0, 0.1, 0.0], r: [0.75, 0, 0], s: 1 },
        { t: 0.32, p: [0, 0.5, -0.05], r: [0.75, 0, 0], s: 1 },
        { t: 0.325, p: [0, 0.5, -0.05], r: [0.75, 0, 0], s: 1, v: false },
    ],
    case: [
        { t: 0.0, p: CASE_IN_BOX, r: [-90 * DEG, 0, 0], s: 1, v: true },
        { t: 0.3, p: CASE_IN_BOX, r: [-90 * DEG, 0, 0], s: 1 },
        { t: 0.4, p: [0, 0.1, 0.03], r: [-55 * DEG, 0, 0], s: 1.25 },
        { t: 0.5, p: CASE_UP, r: [0, 0, 0], s: CASE_SCALE },
        { t: 0.66, p: CASE_UP, r: [0, 0, 0], s: CASE_SCALE },
        { t: 0.78, p: [0, CASE_UP[1] - 0.5, 0], r: [0, 0, 0], s: CASE_SCALE },
        { t: 0.785, p: [0, CASE_UP[1] - 0.5, 0], r: [0, 0, 0], s: CASE_SCALE, v: false },
    ],
    glasses: [
        { t: 0.0, p: GLASSES_IN_CASE, r: [0, 0, 0], s: CASE_SCALE, v: false },
        { t: 0.52, p: GLASSES_IN_CASE, r: [0, 0, 0], s: CASE_SCALE, v: true },
        { t: 0.6, p: GLASSES_IN_CASE, r: [0, 0, 0], s: CASE_SCALE },
        { t: 0.72, p: [0, 0.125, GLASSES_IN_CASE[2]], r: [0, 0, 0], s: CASE_SCALE },
        { t: 0.8, p: [0, 0.04, 0.05], r: [0.1, 0.5, 0], s: 1.65 },
        { t: 0.86, p: [0, 0, 0], r: [0.08, 0, 0], s: 1.7 },
        { t: 1.0, p: [0, 0, 0], r: [0.08, Math.PI * 2, 0], s: 1.7 },
    ],
};
const ANGLES = {
    flap: [{ t: 0.5, a: 0 }, { t: 0.6, a: FLAP_OPEN }],
    templeL: [{ t: 0.72, a: TEMPLE_L_FOLDED }, { t: 0.84, a: 0 }],
    templeR: [{ t: 0.74, a: TEMPLE_R_FOLDED }, { t: 0.86, a: 0 }],
    manualFold: [{ t: 0.0, a: MANUAL_FOLDED }, { t: 1, a: MANUAL_FOLDED }],
};
function clamp01(x) {
    return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}
const ease = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
function sample(keys, p) {
    let visible = true;
    for (const k of keys)
        if (k.t <= p && k.v !== undefined)
            visible = k.v;
    if (p <= keys[0].t)
        return { position: keys[0].p, rotation: keys[0].r, scale: keys[0].s, visible };
    for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        if (p <= b.t) {
            const t = ease((p - a.t) / (b.t - a.t));
            return { position: mix3(a.p, b.p, t), rotation: mix3(a.r, b.r, t), scale: mix(a.s, b.s, t), visible };
        }
    }
    const last = keys[keys.length - 1];
    return { position: last.p, rotation: last.r, scale: last.s, visible };
}
function sampleNum(keys, p) {
    if (p <= keys[0].t)
        return keys[0].a;
    for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        if (p <= b.t)
            return mix(a.a, b.a, ease((p - a.t) / (b.t - a.t)));
    }
    return keys[keys.length - 1].a;
}
/** The whole composition at a given scroll progress. Values outside 0..1 are clamped. */
export function poseAt(progress) {
    const p = clamp01(progress);
    const parts = {};
    for (const id of Object.keys(TRACKS))
        parts[id] = sample(TRACKS[id], p);
    return {
        parts,
        angles: {
            flap: sampleNum(ANGLES.flap, p),
            templeL: sampleNum(ANGLES.templeL, p),
            templeR: sampleNum(ANGLES.templeR, p),
            manualFold: sampleNum(ANGLES.manualFold, p),
        },
    };
}
