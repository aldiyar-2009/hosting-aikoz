// Moon phase geometry, shared by the site's moon. Pure functions, no DOM.
// `lit` is the illuminated fraction of the disc: 0 = new moon, 0.5 = first quarter, 1 = full moon.
// The moon waxes the way it does in the northern hemisphere: the lit side is on the right.
import { SCENES } from '../scene/timeline.js';
export const clampLit = (lit) => (Number.isFinite(lit) ? Math.min(1, Math.max(0, lit)) : 0);
/**
 * SVG path of the lit part of a disc with centre (cx, cy) and radius r.
 * The outer limb is the right half-circle; the terminator is a half-ellipse whose
 * horizontal radius shrinks to zero at the first quarter and grows back towards the full moon.
 */
export function litPath(lit, cx, cy, r) {
    const k = clampLit(lit);
    if (k <= 0)
        return '';
    if (k >= 1)
        return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    const rx = Math.abs(1 - 2 * k) * r;
    // from the bottom back to the top: through the right side for a crescent, through the left for a gibbous moon
    const sweep = k < 0.5 ? 0 : 1;
    return `M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}A${rx} ${r} 0 0 ${sweep} ${cx} ${cy - r}Z`;
}
/**
 * The soft terminator. The moon is drawn as a lit right half plus one ellipse over the middle of the disc:
 * a dark one ("shade") before the first quarter, a lit one ("bulge") after it. The ellipse is solid up to
 * TERMINATOR_SOLID of its radius and fades out beyond, so it is drawn larger than the terminator by
 * 1 / TERMINATOR_SOLID: the solid edge is the true terminator and the fade is its soft shadow.
 */
export const TERMINATOR_SOLID = 0.84;
export function terminator(lit) {
    const k = clampLit(lit);
    const sy = 1 / TERMINATOR_SOLID;
    return k < 0.5
        ? { side: 'shade', sx: (1 - 2 * k) / TERMINATOR_SOLID, sy }
        : { side: 'bulge', sx: (2 * k - 1) / TERMINATOR_SOLID, sy };
}
/** How strong the halo around the disc is: a new moon barely glows, a full one glows fully. */
export const haloFor = (lit) => 0.12 + 0.88 * clampLit(lit);
/**
 * Phases of the unboxing story, one per scene: the closed box is a thin young crescent (a true new
 * moon cannot be seen, so the story does not start from zero), each step of the unboxing adds light,
 * and the glasses come out unfolded under the full moon.
 * The first phase is also the moon of the first screen (Hero): the story picks up the very crescent the
 * visitor has just seen, so the two moons never argue. 14 % is the thinnest crescent that still reads as
 * a moon at the 95 px of a phone.
 */
export const STORY_PHASES = [0.14, 0.25, 0.5, 0.75, 0.92, 1];
/**
 * Illuminated fraction for a story progress of 0..1. Each scene starts at its own phase and grows
 * towards the next one; the last scene (the open glasses turning round) stays under the full moon.
 */
export function litForProgress(progress) {
    const p = clampLit(progress);
    const last = SCENES.length - 1;
    for (let i = 0; i < last; i++) {
        const from = SCENES[i].from;
        const to = SCENES[i + 1].from;
        if (p < to)
            return STORY_PHASES[i] + (STORY_PHASES[i + 1] - STORY_PHASES[i]) * ((p - from) / (to - from));
    }
    return STORY_PHASES[last];
}
