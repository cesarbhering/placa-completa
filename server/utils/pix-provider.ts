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
  // No app do banco a AbacatePay aparece como "Haste Technologies", que nao diz
  // nada pra quem paga (foi a razao da troca). Quando a cobranca cai AQUI e so
  // porque a Woovi falhou e a AbacatePay assumiu de salva-vidas — nesse caso a
  // tela NAO promete nome (decisao do Cesar 24/set): melhor nao citar recebedor
  // do que mostrar um nome que confunde.
  nomeDoRecebedor: () => null,
}

const WOOVI: ProvedorPix = {
  nome: 'woovi',
  criarPixTransparente: woovi.criarPixTransparente,
  checarPix: woovi.checarPix,
  reembolsarPix: woovi.reembolsarPix,
  simularPagamento: woovi.simularPagamento,
  // A Woovi reflete o nome real da conta no Pix — o motivo da troca. Mas o nome
  // que aparece no app do banco (campo 59 do BR Code) e o que a conta Woovi tem
  // registrado, e no sandbox ele veio como o nome legal ("CESAR CANCADO BHERING
  // TEC"), nao "PLACA COMPLETA". Entao a tela NAO crava o nome: ele vem da env
  // WOOVI_RECEBEDOR, preenchida so DEPOIS de conferir num Pix real de producao
  // qual e a string exata. Vazio => null => a tela nao promete nome nenhum, em
  // vez de prometer um que o pagador nao ve.
  nomeDoRecebedor: () => String(useRuntimeConfig().wooviRecebedor || '').trim() || null,
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

/**
 * Cria a cobranca no provedor preferencial e, se ele FALHAR, cai no salva-vidas.
 *
 * Decisao do Cesar (24/set): Woovi preferencial, AbacatePay como salva-vidas,
 * pra nao ficar refem de um gateway so. Se um dia o env voltar pra abacatepay,
 * e AbacatePay PURO (sem Woovi no caminho) — rollback limpo, previsivel.
 *
 * O failover fica SO aqui, na criacao. Depois que a cobranca existe, cada
 * pedido guarda seu pix_provider e status/estorno batem sempre na porta certa;
 * "trocar de provedor" com uma cobranca ja criada duplicaria cobranca. Este e
 * o unico ponto seguro: antes de qualquer dinheiro entrar.
 *
 * Devolve QUAL provedor de fato criou. O checkout grava esse nome no pedido e
 * mostra o recebedor dele: Woovi = "PLACA COMPLETA"; se caiu na AbacatePay, sem
 * nome (a tela nao promete "PLACA COMPLETA" quando o dinheiro vai pra outra
 * conta).
 */
export async function criarPixComFallback(
  opts: CriarPixOpts,
): Promise<{ charge: PixCharge; provedor: ProvedorPix }> {
  const primario = provedorPix()
  // So a Woovi tem salva-vidas. AbacatePay primaria = AbacatePay pura.
  const cadeia = primario.nome === 'woovi' ? [WOOVI, ABACATEPAY] : [ABACATEPAY]
  let ultimoErro: unknown = null
  for (const provedor of cadeia) {
    try {
      const charge = await provedor.criarPixTransparente(opts)
      if (provedor !== primario) {
        console.warn(
          `[pix] failover: ${primario.nome} falhou, cobranca criada na ${provedor.nome}. pedido=${opts.pedidoId}`,
        )
      }
      return { charge, provedor }
    } catch (e: any) {
      ultimoErro = e
      console.warn(
        `[pix] ${provedor.nome} falhou ao criar cobranca (pedido=${opts.pedidoId}):`,
        e?.message || e,
      )
    }
  }
  // Todos falharam: propaga o erro, o checkout devolve 5xx como sempre fez.
  throw ultimoErro instanceof Error
    ? ultimoErro
    : createError({ statusCode: 502, message: 'Nenhum provedor de Pix disponivel.' })
}
