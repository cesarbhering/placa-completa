// Aviso ao cliente quando um registro de leilao ou indicio de sinistro aparece
// DEPOIS da entrega do relatorio (Cesar, 21/out/2026): lazy-fill da pagina,
// job da base parceira, backfill. Mesmo esquema do aviso de fotos
// (server/utils/aviso-fotos.ts): no maximo UM e-mail por pedido
// (pedidos_premium.aviso_leilao_em, marcado ANTES de enviar e desfeito se o
// envio falhar), so pedido entregue com e-mail.
// Flag LEILAO_AVISO_EMAIL: '1' liga, '0' desliga; sem a env, ligado so fora do
// staging/homolog.
import { enviarAvisoLeilao, type InfoAvisoLeilao } from './premium-email'
import { comitenteExibicao } from '../../shared/leilao-exibicao'

/** Tem algo no historico: passagem de qualquer nivel ou indicio de sinistro da base parceira. */
export function temLeilaoOuSinistro(h: any): boolean {
  if (!h || typeof h !== 'object') return false
  const n = Array.isArray(h.passagens) ? h.passagens.length : 0
  return n > 0 || h?.sinistro_parceiro?.indicio === true
}

/** Antes vazio (ou sem historico) e depois com algo. */
export function leilaoSurgiu(antes: any, depois: any): boolean {
  return !temLeilaoOuSinistro(antes) && temLeilaoOuSinistro(depois)
}

export function avisoLeilaoLigado(config: any, env: string | undefined = process.env.LEILAO_AVISO_EMAIL): boolean {
  if (env === '1') return true
  if (env === '0') return false
  return !config?.public?.staging && !config?.public?.gated
}

export function infoDoHistorico(h: any): InfoAvisoLeilao {
  const passagens = (Array.isArray(h?.passagens) ? h.passagens : []).map((p: any) => ({
    nivel: String(p?.nivel || ''),
    data_leilao: p?.data_leilao ?? null,
    comitente: comitenteExibicao(p?.comitente)?.texto ?? null,
  }))
  return { passagens, sinistro: h?.sinistro_parceiro?.indicio === true }
}

export async function avisarLeilaoTardio(
  supabase: any,
  pedidoId: string,
  antes: any,
  depois: any,
  deps: { enviar?: typeof enviarAvisoLeilao; agora?: () => Date; ligado?: boolean; log?: (m: string) => void } = {},
): Promise<'sem_mudanca' | 'desligado' | 'enviado' | 'ja_avisado' | 'sem_email' | 'falhou'> {
  const log = deps.log ?? ((m: string) => console.info(m))
  try {
    if (!leilaoSurgiu(antes, depois)) return 'sem_mudanca'
    if (!(deps.ligado ?? avisoLeilaoLigado(useRuntimeConfig()))) return 'desligado'
    const { data: p } = await supabase.from('pedidos_premium')
      .select('email,placa,token_entrega,status,aviso_leilao_em').eq('id', pedidoId).maybeSingle()
    if (!p || p.status !== 'entregue') return 'falhou'
    if (p.aviso_leilao_em) return 'ja_avisado'
    if (!String(p.email || '').includes('@')) return 'sem_email'
    const { data: marcado, error } = await supabase.from('pedidos_premium')
      .update({ aviso_leilao_em: (deps.agora?.() ?? new Date()).toISOString() })
      .eq('id', pedidoId).is('aviso_leilao_em', null).select('id')
    if (error || !marcado?.length) return 'ja_avisado'
    const ok = await (deps.enviar ?? enviarAvisoLeilao)({ email: p.email, token: p.token_entrega, placa: p.placa, info: infoDoHistorico(depois) })
    if (!ok) {
      await supabase.from('pedidos_premium').update({ aviso_leilao_em: null }).eq('id', pedidoId)
      log(`[aviso-leilao] pedido=${pedidoId}: envio falhou (tenta na proxima mudanca)`)
      return 'falhou'
    }
    log(`[aviso-leilao] pedido=${pedidoId}: aviso enviado`)
    return 'enviado'
  } catch (e: any) {
    console.warn('[aviso-leilao] falhou (fail-open):', e?.message || e)
    return 'falhou'
  }
}
