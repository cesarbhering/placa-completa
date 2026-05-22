/**
 * Detects referrals coming from generative-AI assistants and fires a custom
 * GA4 event so we can measure the GEO channel separately from organic search.
 *
 * To use this in GA4 reporting, mark "ai_referral" as a conversion event in
 * the GA4 admin (Events → Mark as conversion) and add the ai_source param to
 * custom dimensions.
 */
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const ref = document.referrer
  if (!ref) return

  const sources: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /(^|\.)chatgpt\.com/i, name: 'chatgpt' },
    { pattern: /(^|\.)chat\.openai\.com/i, name: 'chatgpt' },
    { pattern: /(^|\.)perplexity\.ai/i, name: 'perplexity' },
    { pattern: /(^|\.)claude\.ai/i, name: 'claude' },
    { pattern: /(^|\.)gemini\.google\.com/i, name: 'gemini' },
    { pattern: /(^|\.)bard\.google\.com/i, name: 'gemini' },
    { pattern: /(^|\.)copilot\.microsoft\.com/i, name: 'copilot' },
    { pattern: /(^|\.)you\.com/i, name: 'you_com' },
    { pattern: /(^|\.)phind\.com/i, name: 'phind' },
    { pattern: /(^|\.)deepseek\.com/i, name: 'deepseek' },
    { pattern: /(^|\.)meta\.ai/i, name: 'meta_ai' },
  ]

  let aiSource: string | null = null
  try {
    const host = new URL(ref).hostname
    for (const { pattern, name } of sources) {
      if (pattern.test(host)) {
        aiSource = name
        break
      }
    }
  } catch {
    return
  }

  if (!aiSource) return

  // Fire when gtag becomes available (tracking scripts load deferred).
  const fire = () => {
    const gtag = (window as any).gtag
    if (typeof gtag !== 'function') return false
    gtag('event', 'ai_referral', {
      ai_source: aiSource,
      referrer: ref,
      landing_page: window.location.pathname,
    })
    return true
  }

  if (fire()) return

  let attempts = 0
  const interval = setInterval(() => {
    attempts++
    if (fire() || attempts > 20) {
      clearInterval(interval)
    }
  }, 500)
})
