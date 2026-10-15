import { POST_LANGUAGE } from "../constants/post.constants.js";

/*
|--------------------------------------------------------------------------
| POST LANGUAGE (script-based fallback)
|--------------------------------------------------------------------------
|
| Works out a post's language from the alphabet it is written in. This
| needs no AI, so it is used when a post is created and whenever the AI
| check is unavailable.
|
| Limit: Sinhala typed in English letters ("mata godak dukai") looks
| like English here. Only the AI check can tell those apart; when it
| runs, its answer replaces this one.
|
*/

const SINHALA_LETTERS = /[඀-෿]/g;
const TAMIL_LETTERS = /[஀-௿]/g;
const LATIN_LETTERS = /[A-Za-z]/g;

/*
 * Share of a post's letters that must be Sinhala/Tamil script for the
 * post to count as that language.
 */
const LOCAL_SCRIPT_SHARE = 0.3;

const count = (text, pattern) => (text.match(pattern) ?? []).length;

/**
 * @param {string} text
 * @returns {string} A POST_LANGUAGE value.
 */
export const detectLanguageByScript = (text) => {
  if (typeof text !== "string") {
    return POST_LANGUAGE.OTHER;
  }

  const sinhala = count(text, SINHALA_LETTERS);
  const tamil = count(text, TAMIL_LETTERS);
  const latin = count(text, LATIN_LETTERS);

  const total = sinhala + tamil + latin;

  if (total === 0) {
    /*
     * Only emoji, digits or punctuation.
     */
    return POST_LANGUAGE.OTHER;
  }

  /*
   * Sinhala and Tamil posts often mix in English words ("මට අද දුකයි,
   * but I will try"), so a simple "most letters wins" count would call
   * them English. A meaningful share of local script is the stronger
   * signal; one borrowed word in an English post is not.
   */
  const localScript = Math.max(sinhala, tamil);

  if (localScript / total >= LOCAL_SCRIPT_SHARE) {
    return sinhala >= tamil ? POST_LANGUAGE.SI : POST_LANGUAGE.TA;
  }

  return POST_LANGUAGE.EN;
};
