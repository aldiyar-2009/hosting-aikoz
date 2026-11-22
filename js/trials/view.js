// Where the page stands after a card or a trial has just opened. Pure, no DOM.
// The card opens next to the model on a wide screen and right under it on a phone; when the visitor
// cannot see its top, the page moves by the smallest distance that shows what has changed.
/** Height of the fixed site header, px. */
const HEADER_PX = 64;
/** Gap between the header and a panel brought down from above, px. */
const GAP_PX = 16;
/** A panel whose top is closer to the bottom edge than this counts as not seen, px. */
const SEEN_PX = 96;
/** How much of a panel is brought into view from below, px: the title, the text and the first action. */
const PEEK_PX = 220;
/**
 * How far to scroll (px, positive is down) so that a panel that has just opened is seen.
 * 0 - its top is already on screen and nothing moves.
 * @param top top edge of the panel relative to the viewport
 * @param viewportHeight height of the viewport
 */
export function revealDelta(top, viewportHeight) {
    if (!Number.isFinite(top) || !Number.isFinite(viewportHeight) || viewportHeight <= 0)
        return 0;
    // hidden behind the header or above the screen: bring the top right under the header
    if (top < HEADER_PX)
        return Math.round(top - HEADER_PX - GAP_PX);
    // too low: show the beginning of the panel and keep as much of the model as possible
    if (top > viewportHeight - SEEN_PX) {
        const peek = Math.min(PEEK_PX, viewportHeight - HEADER_PX - GAP_PX);
        return Math.max(0, Math.round(top - (viewportHeight - peek)));
    }
    return 0;
}
