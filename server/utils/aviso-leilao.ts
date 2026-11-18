// Aviso ao cliente quando um registro de leilao ou indicio de sinistro aparece
// DEPOIS da entrega do relatorio (Cesar, 21/out/2026): lazy-fill da pagina,
// job da base parceira, backfill. Mesmo esquema do aviso de fotos
// (server/utils/aviso-fotos.ts): marcado ANTES de enviar e desfeito se o
// envio falhar, so pedido entregue com e-mail.
// Since 18/11/2026 ("Avisar sempre"), compared as the page shows the auction
// section (merged with the vehicle history, model lock, one card per auction):
//  - auction notice (pedidos_premium.aviso_leilao_em, at most one per order):
//    the page showed no auction and now shows one, even if it already showed
//    a damage sign;
//  - damage notice (aviso_sinistro_em): the page showed nothing and now shows
//    only the damage sign. It does not block a later auction notice.
// Flag LEILAO_AVISO_EMAIL: '1' liga, '0' desliga; sem a env, ligado so fora do
// staging/homolog.
import { enviarAvisoLeilao, type InfoAvisoLeilao } from './premium-email'
import { comitenteExibicao, ligadoPeloMotor, historicoNaTela } from '../../shared/leilao-exibicao'

/** Tem algo no historico: passagem de qualquer nivel ou indicio de sinistro da base parceira. */
export function temLeilaoOuSinistro(h: any): boolean {
  if (!h || typeof h !== 'object') return false
  const n = Array.isArray(h.passagens) ? h.passagens.length : 0
  return n > 0 || h?.sinistro_parceiro?.indicio === true
}

/** Auction cards as the page shows them (model lock, one card per auction). */
function passagensNaTela(h: any, veiculo: { modelo?: string | null } | null): any[] {
  const exib: any = historicoNaTela(h, veiculo)
  return Array.isArray(exib?.passagens) ? exib.passagens : []
}

export type TipoAviso = 'leilao' | 'sinistro'

/**
 * Which late notice a change of the auction section asks for, both sides as
 * the page shows them (Cesar, 18/11/2026, "Avisar sempre"): 'leilao' when the
 * page showed no auction and now shows at least one, a damage sign before
 * included; 'sinistro' when the page showed nothing and now shows only the
 * damage sign; null otherwise.
 */
export function tipoDoAviso(antes: any, depois: any, veiculo: { modelo?: string | null } | null = null): TipoAviso | null {
  if (passagensNaTela(antes, veiculo).length) return null
  if (passagensNaTela(depois, veiculo).length) return 'leilao'
  const indicio = (h: any) => h?.sinistro_parceiro?.indicio === true
  return !indicio(antes) && indicio(depois) ? 'sinistro' : null
}

export function avisoLeilaoLigado(config: any, env: string | undefined = process.env.LEILAO_AVISO_EMAIL): boolean {
  if (env === '1') return true
  if (env === '0') return false
  return !config?.public?.staging && !config?.public?.gated
}

/**
 * Vehicle model from the order snapshot's consulta.response. The snapshot
 * stores response as a flat object (filtrarPorPlano -> normalizarResposta);
 * older rows may hold a one-item list. Both are read (review 2 of PR #750:
 * reading only response->0 gave null on the object and skipped the model lock).
 */
export function modeloDaResposta(r: unknown): string | null {
  const v = (Array.isArray(r) ? r[0] : r) as any
  const m = v && typeof v === 'object' ? v.descricaoMarcaModelo : null
  return typeof m === 'string' && m.trim() ? m.trim() : null
}

export function infoDoHistorico(h: any, veiculo: { modelo?: string | null } | null = null): InfoAvisoLeilao {
  // Same list as the page cards (one card per auction, 13/11/2026), so the
  // "Há mais N registros" in the e-mail matches what the customer sees. Model
  // lock first, as on the page (vehicle model from the order snapshot).
  const exib: any = historicoNaTela(h, veiculo)
  const passagens = (Array.isArray(exib?.passagens) ? exib.passagens : []).map((p: any) => ({
    nivel: String(p?.nivel || ''),
    data_leilao: p?.data_leilao ?? null,
    comitente: comitenteExibicao(p?.comitente)?.texto ?? null,
    // So o fato de a ligacao ter sido pelo motor; o numero nunca entra no aviso.
    ligadoPorMotor: ligadoPeloMotor(p),
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
    // Nothing in the section after: nothing to tell (the order is not read).
    if (!temLeilaoOuSinistro(depois)) return 'sem_mudanca'
    if (!(deps.ligado ?? avisoLeilaoLigado(useRuntimeConfig()))) return 'desligado'
    const { data: p } = await supabase.from('pedidos_premium')
      .select('email,placa,token_entrega,status,aviso_leilao_em,aviso_sinistro_em,resposta:relatorio_snapshot->consulta->response').eq('id', pedidoId).maybeSingle()
    if (!p || p.status !== 'entregue') return 'falhou'
    // Model lock as on the page (vehicle model from the order snapshot).
    const veiculo = { modelo: modeloDaResposta(p.resposta) }
    const tipo = tipoDoAviso(antes, depois, veiculo)
    if (!tipo) return 'sem_mudanca'
    // One auction notice per order; the damage sign alone only while nothing was told.
    if (p.aviso_leilao_em || (tipo === 'sinistro' && p.aviso_sinistro_em)) return 'ja_avisado'
    if (!String(p.email || '').includes('@')) return 'sem_email'
    const coluna = tipo === 'leilao' ? 'aviso_leilao_em' : 'aviso_sinistro_em'
    let marcar = supabase.from('pedidos_premium')
      .update({ [coluna]: (deps.agora?.() ?? new Date()).toISOString() })
      .eq('id', pedidoId).is('aviso_leilao_em', null)
    if (tipo === 'sinistro') marcar = marcar.is('aviso_sinistro_em', null)
    const { data: marcado, error } = await marcar.select('id')
    if (error || !marcado?.length) return 'ja_avisado'
    const ok = await (deps.enviar ?? enviarAvisoLeilao)({ email: p.email, token: p.token_entrega, placa: p.placa, info: infoDoHistorico(depois, veiculo) })
    if (!ok) {
      await supabase.from('pedidos_premium').update({ [coluna]: null }).eq('id', pedidoId)
      log(`[aviso-leilao] pedido=${pedidoId}: envio falhou (tenta na proxima mudanca)`)
      return 'falhou'
    }
    log(`[aviso-leilao] pedido=${pedidoId}: aviso de ${tipo} enviado`)
    return 'enviado'
  } catch (e: any) {
    console.warn('[aviso-leilao] falhou (fail-open):', e?.message || e)
    return 'falhou'
  }
}
