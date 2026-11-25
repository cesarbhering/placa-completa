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
 * come whole: the cap only stops a runaway source (the base already ends its
 * texts at 1500 characters).
 */
export const RECALL_TEXT_CAP = 3000

/**
 * The text whole when it fits in `max`; otherwise cut at the end of a word, with
 * "…", the ellipsis included in `max`. Expects collapsed whitespace. Only a text
 * with no space at all (not real copy) is cut at the cap itself.
 */
export function capAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const room = text.slice(0, max - 1)
  const lastSpace = room.lastIndexOf(' ')
  const cut = text[max - 1] === ' ' || lastSpace <= 0 ? room : room.slice(0, lastSpace)
  return `${cut.replace(/[\s,;:.]+$/, '')}…`
}
