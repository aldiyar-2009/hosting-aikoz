/**
 * Turns presses on a control into the gestures of the glasses.
 * `x` is the pointer position along the control (px); it only matters for swipes.
 * One press never yields two gestures: a double tap is not also two taps,
 * and releasing after a long press yields nothing.
 */
export function createRecognizer(opts) {
    const longMs = opts.longMs ?? 600;
    const multiGapMs = opts.multiGapMs ?? 320;
    const swipePx = opts.swipePx ?? 40;
    let downX = 0;
    let pressed = false;
    let longFired = false;
    let taps = 0;
    let longTimer;
    let gapTimer;
    const flush = () => {
        const n = taps;
        taps = 0;
        gapTimer = undefined;
        if (n === 1)
            opts.onGesture('tap');
        else if (n === 2)
            opts.onGesture('double');
        else if (n >= 3)
            opts.onGesture('triple');
    };
    return {
        down(x) {
            if (pressed)
                return;
            pressed = true;
            longFired = false;
            downX = x;
            clearTimeout(gapTimer);
            gapTimer = undefined;
            longTimer = setTimeout(() => {
                longFired = true;
                taps = 0;
                opts.onGesture('long');
            }, longMs);
        },
        up(x) {
            if (!pressed)
                return;
            pressed = false;
            clearTimeout(longTimer);
            if (longFired)
                return;
            const dx = x - downX;
            if (Math.abs(dx) >= swipePx) {
                taps = 0;
                opts.onGesture(dx > 0 ? 'swipeFwd' : 'swipeBack');
                return;
            }
            taps += 1;
            gapTimer = setTimeout(flush, multiGapMs);
        },
        cancel() {
            pressed = false;
            taps = 0;
            clearTimeout(longTimer);
            clearTimeout(gapTimer);
            gapTimer = undefined;
        },
    };
}
