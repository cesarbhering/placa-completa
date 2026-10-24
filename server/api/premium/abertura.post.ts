import { registrarAbertura } from '../../utils/relatorio-aberturas'

// Abertura que nao passa pelo /api/premium/report: hoje so o "Imprimir" (PDF)
// do relatorio. Mesmo registro e mesmo dedupe (server/utils/relatorio-aberturas.ts).
// O token e a credencial; sempre 204, mesmo com token desconhecido.
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 204)
  try {
    const body = await readBody(event).catch(() => null)
    const token = String(body?.token || '').trim()
    const o = String(body?.o || '') === 'pdf' ? 'pdf' : 'pagina'
    if (!token || token.length > 64) return null
    const supabase = usePremiumSupabase()
    const { data: pedido } = await supabase.from('pedidos_premium').select('id,status,ip_address').eq('token_entrega', token).maybeSingle()
    if (pedido) await registrarAbertura(supabase, event, pedido, token, o)
  } catch { /* medicao nunca quebra a pagina */ }
  return null
})
