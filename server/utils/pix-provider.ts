import * as abacate from './abacatepay'
import * as woovi from './woovi'

// Contrato unico de provedor de Pix, pra dar pra trocar de adquirente sem
// reescrever o checkout.
//
// Por que isto existe: a AbacatePay atende mal e, no app do banco, o recebedor
// aparece como "Haste Technologies" (conferido no BR Code de pedidos reais),
// que nao diz nada pra quem esta pagando. A troca vale a pena, mas trocar
// direto no checkout seria uma cirurgia sem plano B. Aqui a escolha e uma env,
// e voltar atras e mudar uma palavra.
//
// O default e abacatepay de proposito: enquanto ninguem setar a env, producao
// segue exatamente como hoje.

export interface PixCharge {
  /** Id no provedor. Vai pra pedidos_premium.abacatepay_id (nome legado). */
  id: string
  amount: number
  status: string
  brCode: string
  brCodeBase64: string
  expiresAt: string | null
}

export interface CriarPixOpts {
  amountCentavos: number
  pedidoId: string
  descricao?: string
  expiresIn?: number
  customer?: { email: string; cellphone?: string; name?: string }
  metadata?: Record<string, string>
}

export interface ProvedorPix {
  nome: 'abacatepay' | 'woovi'
  criarPixTransparente(opts: CriarPixOpts): Promise<PixCharge>
  checarPix(id: string): Promise<{ status: string; brCode?: string; brCodeBase64?: string } | null>
  reembolsarPix(id: string, motivo?: string): Promise<{ ok: boolean; error: string | null }>
  simularPagamento(id: string): Promise<boolean>
  /**
   * Nome que aparece como recebedor no app do banco de quem paga. Null quando
   * ainda nao foi confirmado num Pix real: a tela so promete o que a gente
   * conferiu.
   */
  nomeDoRecebedor(): string | null
}

const ABACATEPAY: ProvedorPix = {
  nome: 'abacatepay',
  criarPixTransparente: abacate.criarPixTransparente,
  checarPix: abacate.checarPix,
  reembolsarPix: abacate.reembolsarPix,
  simularPagamento: abacate.simularPagamento,
  // Conferido no campo 59 do BR Code de pedidos reais de producao.
  nomeDoRecebedor: () => 'Haste Technologies',
}

const WOOVI: ProvedorPix = {
  nome: 'woovi',
  criarPixTransparente: woovi.criarPixTransparente,
  checarPix: woovi.checarPix,
  reembolsarPix: woovi.reembolsarPix,
  simularPagamento: woovi.simularPagamento,
  // Ainda nao confirmado num Pix real. Enquanto for null, a tela nao promete
  // nome nenhum, em vez de chutar.
  nomeDoRecebedor: () => null,
}

/** Provedor escolhido por env. Sem env, nada muda. */
export function provedorPix(): ProvedorPix {
  const escolhido = String(useRuntimeConfig().pixProvider || 'abacatepay').toLowerCase()
  return escolhido === 'woovi' ? WOOVI : ABACATEPAY
}

/**
 * Provedor de um pedido JA criado. O pedido guarda em qual provedor a cobranca
 * nasceu: sem isso, trocar a env no meio do caminho faria o status e o
 * reembolso de pedidos antigos baterem na porta errada.
 */
export function provedorDoPedido(nome?: string | null): ProvedorPix {
  return String(nome || '').toLowerCase() === 'woovi' ? WOOVI : ABACATEPAY
}
