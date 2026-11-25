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
