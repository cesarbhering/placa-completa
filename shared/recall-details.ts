// Long recall texts fold into a closed <details> on the paid report (Cesar,
// 24/11/2026): with three campaigns of 400 to 600 characters of risk each, the
// card got too tall. The campaign name stays visible; the summary says what
// opens. On paper the texts print open (see the print rules in the report page).

/** Summary of the folded campaign description (manufacturer or public record cards). */
export const RECALL_DESCRIPTION_LABEL = 'Ver a descrição'

/**
 * Summary of the folded risk and what-to-do texts of one campaign, or null when
 * the campaign has neither (then no accordion is drawn). Truthiness matches the
 * template's v-if on each text.
 */
export function recallDetailsLabel(c: { risco?: string | null; oQueFazer?: string | null }): string | null {
  if (c.risco && c.oQueFazer) return 'Ver o risco e o que fazer'
  if (c.risco) return 'Ver o risco'
  if (c.oQueFazer) return 'Ver o que fazer'
  return null
}

/**
 * Safety cap of a campaign's free text (risk, what to do). Folded, the text can
 * come whole: the cap only stops a runaway source. Today the recall base sends
 * at most 1500 characters per text, and for several brands it already cuts the
 * risk at 900, in the middle of a word.
 */
export const RECALL_TEXT_CAP = 3000

/**
 * End of a text that goes on past `room`: at the end of its last whole word,
 * with "…". When `endsWord`, the last word of `room` is whole. When the last
 * space falls before `minKeep` (a run with no space, not real copy), the cut
 * stays at the end of `room`, so the text is not thrown away.
 */
function endAtWord(room: string, endsWord: boolean, minKeep: number): string {
  const lastSpace = room.lastIndexOf(' ')
  const cut = endsWord || lastSpace < minKeep ? room : room.slice(0, lastSpace)
  return `${cut.replace(/[\s,;:.!?]+$/, '')}…`
}

/**
 * The text whole when it fits in `max`; otherwise cut at the end of a word, with
 * "…", the ellipsis included in `max`. Expects collapsed whitespace. When the
 * last space falls before half of `max`, the cut is at `max` itself.
 */
export function capAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  return endAtWord(text.slice(0, max - 1), text[max - 1] === ' ', max / 2)
}

/** Length at which the base texts were cut until 24/11/2026: mid-word, with no ellipsis. */
export const OLD_RECALL_TEXT_CUT = 600

/**
 * On screen, a risk or what-to-do text that an order delivered before 24/11/2026
 * holds cut at exactly 600 characters: back to the end of the last whole word,
 * with "…". Any other length shows as it is. Display only: the stored text, and
 * the grouping hash built from it, stay as they are.
 */
export function endOldCut(text: string): string {
  if (text.length !== OLD_RECALL_TEXT_CUT) return text
  return endAtWord(text, /[\s,;:.!?]$/.test(text), OLD_RECALL_TEXT_CUT / 2)
}
