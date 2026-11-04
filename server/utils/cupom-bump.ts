import { createHash } from 'node:crypto'
import { PLANOS } from '../../shared/planos'
import { PRECO_BUMP_CENTAVOS } from '../../shared/cupom-bump'

// Pedido acoplado (Cesar, 04/nov/2026): depois do pagamento confirmado, a
// pessoa ganha uma segunda placa com o relatorio completo por R$ 29,90. E um
// cupom de cupons_premium como os outros (validacao e calculo de sempre em
// server/utils/cupons.ts), com estas travas:
//   - preso ao e-mail do comprador (email_restrito), 1 uso, so a completa;
//   - 24 h a partir da primeira vez que a oferta aparece (valido_ate real);
//   - tipo 'fixo': desconto = preco da completa - 29,90 (piso do plano vale).
// O codigo e derivado do pedido (hash), entao chamar de novo devolve o mesmo
// cupom em vez de criar outro. NAO usa pedido_origem_id: essa coluna e unica e
// pertence ao cupom de recompra do mesmo pedido.

export const VALIDADE_BUMP_MS = 24 * 60 * 60 * 1000
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function codigoBump(pedidoId: string): string {
  const h = createHash('sha256').update(`bump|${pedidoId}`).digest()
  let s = 'SEGUNDA'
  for (let i = 0; i < 6; i++) s += ALFABETO[h[i] % ALFABETO.length]
  return s
}

export interface PedidoBump {
  id: string
  status?: string | null
  email?: string | null
  valor_centavos?: number | null
  google_play_order_id?: string | null
  pix_provider?: string | null
  cupom_origem?: string | null
}

export interface CupomBump { codigo: string; validoAte: string; precoCentavos: number }

/** Quem pode receber a oferta: pagou de verdade, tem e-mail, nao e do app e nao veio de outro bump. */
export function pedidoElegivelBump(p: PedidoBump): boolean {
  if (!['pago', 'consultando', 'entregue'].includes(String(p.status || ''))) return false
  if (!(Number(p.valor_centavos) > 0)) return false
  if (!String(p.email || '').includes('@')) return false
  if (p.google_play_order_id || p.pix_provider === 'google_play') return false
  return p.cupom_origem !== 'cupom_bump'
}

/** Desconto fixo que leva a completa a R$ 29,90. */
export function descontoBumpCentavos(): number {
  return Math.max(0, PLANOS.completa.valorCentavos - PRECO_BUMP_CENTAVOS)
}

async function lerCupom(supabase: any, codigo: string) {
  const { data } = await supabase.from('cupons_premium').select('id, codigo, valido_ate, ativo').eq('codigo', codigo).maybeSingle()
  return data as { id: string; codigo: string; valido_ate: string; ativo: boolean } | null
}

/**
 * Cria (ou devolve) o cupom de segunda placa do pedido. Devolve null quando o
 * pedido nao e elegivel, o cupom venceu, ja foi usado ou algo falhou. Nunca lanca.
 */
export async function cupomBumpDoPedido(supabase: any, pedido: PedidoBump, agora = Date.now()): Promise<CupomBump | null> {
  try {
    if (!pedidoElegivelBump(pedido)) return null
    const codigo = codigoBump(pedido.id)
    let cupom = await lerCupom(supabase, codigo)
    if (!cupom) {
      const { error } = await supabase.from('cupons_premium').insert({
        codigo, tipo: 'fixo', valor: descontoBumpCentavos(), planos: ['completa'], ativo: true,
        valido_de: new Date(agora).toISOString(), valido_ate: new Date(agora + VALIDADE_BUMP_MS).toISOString(),
        limite_uso_global: 1, limite_uso_por_cliente: 1, permite_gratis: false,
        email_restrito: String(pedido.email).trim().toLowerCase(), origem: 'bump',
      })
      // Conflito de codigo = outra aba criou ao mesmo tempo: le o que ficou.
      cupom = await lerCupom(supabase, codigo)
      if (!cupom && error) return null
    }
    if (!cupom?.ativo || !cupom.valido_ate || new Date(cupom.valido_ate).getTime() <= agora) return null
    const { count } = await supabase.from('cupons_premium_usos').select('id', { count: 'exact', head: true }).eq('cupom_id', cupom.id)
    if ((count || 0) > 0) return null
    return { codigo: cupom.codigo, validoAte: cupom.valido_ate, precoCentavos: PRECO_BUMP_CENTAVOS }
  } catch {
    return null
  }
}
