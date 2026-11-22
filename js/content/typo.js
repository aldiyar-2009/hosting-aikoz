// Russian typography: a short word (в, и, на, для…) never stays alone at the end of a line.
// Only an ordinary space after the word is replaced, so a second pass can pick up the next short word.
const SHORT = /(^|[\s(«])([А-Яа-яЁё]{1,2}|для|или|про|при|под|над|без|это) +(?=\S)/g;
const NBSP = String.fromCharCode(0xa0);
/**
 * Manrope has the Kazakh ө, ү, һ, і but not ә, ғ, қ, ң, ұ: a word with them would be drawn by two fonts,
 * letter by letter. Text that comes from outside (a track, a caller, a phrase of a translation) and has
 * such a letter is set as a whole in the system font, which has all of them: class `font-system`.
 */
const NOT_IN_MANROPE = /[\u04D8\u04D9\u0492\u0493\u049A\u049B\u04A2\u04A3\u04B0\u04B1]/;
export const wholeFont = (text) => (text && NOT_IN_MANROPE.test(text) ? 'font-system' : '');
/** Glue short words to the next word with a non-breaking space. */
export function tidy(text) {
    // twice: neighbouring short words ("и в приложении") overlap in one pass
    return text.replace(SHORT, `$1$2${NBSP}`).replace(SHORT, `$1$2${NBSP}`);
}
