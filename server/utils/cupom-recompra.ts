import { randomInt } from 'node:crypto'
import { DESCONTO_RECOMPRA_PCT } from '../../shared/cupom-recompra-texto'
export { textoCupomRecompra, dataCurtaBr, DESCONTO_RECOMPRA_PCT } from '../../shared/cupom-recompra-texto'

// Cupom de recompra (decisao do Cesar, 05/out): toda compra paga a partir do
// deploy gera um codigo de DESCONTO_RECOMPRA_PCT% (10% desde 20/out/2026) valido 7 dias desde a entrega, sem limite de
// uso, pra qualquer pessoa (compartilhar e bom pra nos). Vive em
// cupons_premium (origem 'recompra', pedido_origem_id = quem gerou), entao a
// validacao e o calculo sao os de sempre (server/utils/cupons.ts): valor no
// servidor, piso do plano (permite_gratis=false: nunca zera) e um cupom por
// compra (o checkout so aceita um codigo). Sem retroativo: so nasce na entrega.

export const VALIDADE_RECOMPRA_MS = 7 * 24 * 60 * 60 * 1000
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/I

export function gerarCodigoRecompra(rnd: (n: number) => number = randomInt): string {
  let s = 'CARRO'
  for (let i = 0; i < 5; i++) s += ALFABETO[rnd(ALFABETO.length)]
  return s
}

export interface CupomRecompra { codigo: string; validoAte: string; /** Percentual gravado no cupom (20 nos antigos, 10 nos novos). */ pct?: number | null }

/**
 * Gera (ou devolve o ja gerado) o cupom do pedido. Nao gera para pedido de
 * valor zero, do app (Google Play) nem pago COM cupom (qualquer cupom:
 * recompra, recuperacao de Pix, cortesia; regra do Cesar, 20/out/2026). Cupom
 * ja emitido nao muda. Nunca lanca: falha so deixa o pedido sem cupom.
 */
export async function gerarCupomRecompra(
  supabase: any,
  pedido: { id: string; valor_centavos?: number | null; google_play_order_id?: string | null; pix_provider?: string | null; cupom_origem?: string | null },
  entregueEm: Date = new Date(),
): Promise<CupomRecompra | null> {
  try {
    if (!(Number(pedido.valor_centavos) > 0)) return null
    if (pedido.google_play_order_id || pedido.pix_provider === 'google_play') return null
    const { data: existente } = await supabase.from('cupons_premium').select('codigo, valido_ate, valor').eq('pedido_origem_id', pedido.id).maybeSingle()
    if (existente?.codigo) return { codigo: existente.codigo, validoAte: existente.valido_ate, ...(Number(existente.valor) > 0 ? { pct: Number(existente.valor) } : {}) }
    // Pago com cupom: o de recompra marca o pedido (cupom_origem); todo cupom
    // aplicado deixa a linha de uso em cupons_premium_usos (pedido_id unique).
    if (pedido.cupom_origem) return null
    const { data: uso, error: erroUso } = await supabase.from('cupons_premium_usos').select('id').eq('pedido_id', pedido.id).maybeSingle()
    // Sem conseguir conferir, nao gera (melhor um cupom a menos que um indevido).
    if (erroUso || uso) return null
    const validoAte = new Date(entregueEm.getTime() + VALIDADE_RECOMPRA_MS).toISOString()
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const codigo = gerarCodigoRecompra()
      const { error } = await supabase.from('cupons_premium').insert({
        codigo, tipo: 'percentual', valor: DESCONTO_RECOMPRA_PCT, planos: ['basica', 'completa'], ativo: true,
        valido_de: entregueEm.toISOString(), valido_ate: validoAte,
        limite_uso_global: null, limite_uso_por_cliente: null, permite_gratis: false,
        origem: 'recompra', pedido_origem_id: pedido.id,
      })
      if (!error) return { codigo, validoAte, pct: DESCONTO_RECOMPRA_PCT }
    }
    return null
  } catch {
    return null
  }
}

/** Cupom ainda valido do pedido (pra faixa no relatorio). So leitura. */
export async function cupomRecompraDoPedido(supabase: any, pedidoId: string): Promise<CupomRecompra | null> {
  try {
    const { data } = await supabase.from('cupons_premium').select('codigo, valido_ate, ativo, valor').eq('pedido_origem_id', pedidoId).maybeSingle()
    if (!data?.codigo || !data.ativo || !data.valido_ate || new Date(data.valido_ate).getTime() < Date.now()) return null
    return { codigo: data.codigo, validoAte: data.valido_ate, ...(Number(data.valor) > 0 ? { pct: Number(data.valor) } : {}) }
  } catch {
    return null
  }
}

/** Colunas do pedido que usou o cupom: so quando e cupom de recompra aplicado. */
export function origemDoCupom(c: { ok?: boolean; origem?: string | null; pedidoOrigemId?: string | null } | null | undefined): { cupom_origem?: string; cupom_pedido_origem_id?: string } {
  if (!c?.ok || c.origem !== 'recompra') return {}
  return { cupom_origem: 'cupom_recompra', ...(c.pedidoOrigemId ? { cupom_pedido_origem_id: c.pedidoOrigemId } : {}) }
}

/**
 * O cupom de recompra vale sem e-mail (decisao do Cesar, 05/out): ele nao e
 * preso a ninguem. Os outros cupons continuam exigindo e-mail (limite por
 * pessoa / cupom pessoal). Decide no SERVIDOR, pela origem gravada no cupom.
 */
export async function cupomDispensaEmail(supabase: any, codigoBruto: string): Promise<boolean> {
  const codigo = String(codigoBruto || '').trim().toUpperCase().replace(/\s+/g, '')
  if (!codigo) return false
  try {
    const { data } = await supabase.from('cupons_premium').select('origem').eq('codigo', codigo).maybeSingle()
    return data?.origem === 'recompra'
  } catch {
    return false
  }
}
