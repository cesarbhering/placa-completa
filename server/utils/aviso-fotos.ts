// Aviso ao cliente quando o job fotos-depois grava foto numa passagem de
// leilao de um relatorio ja entregue (Cesar, 18/out/2026). Ligado pela flag
// FOTOS_AVISO_EMAIL=1 no plugin (desligado ate o OK do texto).
//
// No maximo UM e-mail por pedido: marca pedidos_premium.aviso_fotos_em ANTES
// de enviar (update condicionado a "ainda nulo"), e desfaz a marca se o envio
// falhar, pra tentar de novo na proxima foto. So pedido entregue com e-mail.
import { enviarAvisoFotos } from './premium-email'

export async function avisarFotosNoRelatorio(
  supabase: any,
  pedidoId: string,
  niveis: string[],
  deps: { enviar?: typeof enviarAvisoFotos; agora?: () => Date } = {},
): Promise<'enviado' | 'ja_avisado' | 'sem_email' | 'falhou'> {
  try {
    const { data: p } = await supabase.from('pedidos_premium')
      .select('email,placa,token_entrega,status,aviso_fotos_em').eq('id', pedidoId).maybeSingle()
    if (!p || p.status !== 'entregue') return 'falhou'
    if (p.aviso_fotos_em) return 'ja_avisado'
    if (!String(p.email || '').includes('@')) return 'sem_email'
    const { data: marcado, error } = await supabase.from('pedidos_premium')
      .update({ aviso_fotos_em: (deps.agora?.() ?? new Date()).toISOString() })
      .eq('id', pedidoId).is('aviso_fotos_em', null).select('id')
    if (error || !marcado?.length) return 'ja_avisado'
    const ok = await (deps.enviar ?? enviarAvisoFotos)({ email: p.email, token: p.token_entrega, placa: p.placa, niveis })
    if (!ok) {
      await supabase.from('pedidos_premium').update({ aviso_fotos_em: null }).eq('id', pedidoId)
      return 'falhou'
    }
    return 'enviado'
  } catch (e: any) {
    console.warn('[aviso-fotos] falhou (fail-open):', e?.message || e)
    return 'falhou'
  }
}
