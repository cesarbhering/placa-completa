// Log fire-and-forget das consultas de agentes ao /llms. Nunca bloqueia a
// resposta nem quebra o endpoint se o insert falhar.
import type { H3Event } from 'h3'
import type { LlmsAnswer } from './llms-answer'

export function logAgentQuery(event: H3Event, answer: LlmsAnswer, format: 'text' | 'json') {
  try {
    const ua = getRequestHeaders(event)['user-agent'] || null
    const country = getRequestHeaders(event)['cf-ipcountry'] || null
    const supabase = useSupabaseServer()
    supabase
      .from('agent_queries')
      .insert({
        query: answer.query,
        intent: answer.intent,
        matched: answer.matched,
        format,
        user_agent: ua,
        geo_country: country,
      })
      .then(({ error }: { error: unknown }) => {
        if (error) console.warn('[agent_queries] insert falhou:', error)
      })
  } catch (e) {
    console.warn('[agent_queries] log falhou:', e)
  }
}
