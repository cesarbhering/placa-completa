import { PLANOS, isPlanoPago } from '~/shared/planos'
import { eventoPermitido, MAX_EVENTOS_POR_LOTE, type EventoFunil } from '~/shared/eventos-funil'
import { origemDaSessao } from '~/shared/origem-trafego'
import { varianteAtual } from '~/shared/ab-bloco'
import { analyticsAtivo } from '~/shared/analytics-tags'

/**
 * Tags ligadas? So fora de homolog/staging (gated). Nunca lanca (o checkout ja
 * caiu um dia inteiro por ReferenceError no tracking): fora do Nuxt (teste)
 * conta como ligado, igual ao comportamento de antes.
 */
export function analyticsAtivoAqui(): boolean {
  if (typeof window === 'undefined') return false
  try { return analyticsAtivo(useRuntimeConfig().public.gated) } catch { return true }
}

// ---------------------------------------------------------------------------
// Funil medido no NOSSO servidor (/api/evento).
//
// O gtag continua igual: o que entra aqui e um espelho, nao um substituto. A
// diferenca e que este dado e nosso, nao e amostrado e nao some com bloqueador
// de anuncio, entao da pra responder "quantos chegaram a VER o CTA" sem
// depender de terceiro.
//
// Envio em lote a cada 2s (ou no pagehide) porque etapa de funil costuma vir
// em rajada: resultado na tela, sinal de leilao, CTA aparecendo, tudo em
// poucos segundos. Uma requisicao por evento seria barulho de rede a toa.
// ---------------------------------------------------------------------------

export interface EventoNaFila {
  evento: EventoFunil
  placa?: string | null
  sessao?: string | null
  origem?: Record<string, string> | null
  leilao_sinal?: string
  recall_sinal?: string
  recall_marca?: string | null
  plano?: string | null
  extra?: Record<string, string | number | boolean> | null
}

let fila: EventoNaFila[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let ouvindoSaida = false

/** Id anonimo por ABA. sessionStorage de proposito: nao e cookie, nao
 *  sobrevive ao fechamento e nao reconhece ninguem numa visita futura. */
export function idDaSessao(): string | null {
  try {
    let id = sessionStorage.getItem('pc_sess')
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('pc_sess', id)
    }
    return id
  } catch {
    return null
  }
}

/** So pra teste: devolve e limpa o que esta na fila. */
export function _filaFunil(): EventoNaFila[] {
  return fila
}
export function _limparFilaFunil() {
  fila = []
  if (timer) { clearTimeout(timer); timer = null }
}

/**
 * Manda o lote. sendBeacon primeiro porque ele sobrevive a pagina fechando,
 * que e exatamente o caso de `checkout_fechado_sem_pagar`; fetch com keepalive
 * e o plano B de quem nao tem beacon.
 */
export function enviarFunil() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!fila.length) return
  const lote = fila.slice(0, MAX_EVENTOS_POR_LOTE)
  fila = fila.slice(MAX_EVENTOS_POR_LOTE)
  const corpo = JSON.stringify({ eventos: lote })
  try {
    const beacon = globalThis.navigator?.sendBeacon?.bind(globalThis.navigator)
    if (beacon && beacon('/api/evento', new Blob([corpo], { type: 'application/json' }))) return
    void fetch('/api/evento', { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo, keepalive: true }).catch(() => {})
  } catch {
    // Medicao nunca quebra pagina.
  }
  if (fila.length) agendarEnvio()
}

function agendarEnvio() {
  if (timer) return
  timer = setTimeout(() => { timer = null; enviarFunil() }, 2000)
}

/**
 * Enfileira UMA etapa do funil. Nome fora da allowlist nao entra: a lista de
 * etapas e um contrato com a tabela, nao um saco de cliques.
 *
 * Nada identificavel atravessa: e-mail, telefone, chassi e token ficam de fora
 * por construcao (o unico campo livre e `extra`, saneado no servidor).
 */
// Hook de recall da consulta gratis desta visita (igual ao ab_bloco): depois
// que o sinal resolve, TODO evento do funil sai carimbado com ele (CTA, checkout,
// pix_gerado...), pra medir se quem viu a frase de recall compra mais.
let recallAtual: { sinal: string; marca: string | null } | null = null
/** pages/index.vue chama quando o sinal resolve; null ao trocar de placa. */
export function definirRecallSinal(sinal: string | null, marca?: string | null): void {
  recallAtual = sinal ? { sinal, marca: marca ?? null } : null
}
export function recallSinalAtual(): { sinal: string; marca: string | null } | null { return recallAtual }

export function enfileirarEventoFunil(evento: string, dados?: Omit<EventoNaFila, 'evento'>) {
  // `typeof window` e nao `import.meta.client`: a checagem precisa valer
  // tambem fora do build do Nuxt (teste unitario), e o efeito e o mesmo, ja
  // que no servidor nao existe window.
  if (typeof window === 'undefined') return
  if (!eventoPermitido(evento)) return
  if (fila.length >= 50) return   // teto de memoria se a rede estiver fora
  // Variante do teste A/B do bloco bloqueado carimbada em TODO evento da
  // visita: sem isso da pra medir o clique no CTA, mas nao pix_gerado por
  // variante, que e a unica etapa que paga a conta. So carimba depois que a
  // variante existe (ela e sorteada quando o resultado da consulta chega);
  // evento anterior a isso fica sem o campo, de proposito.
  const ab = varianteAtual()
  const extra = ab ? { ...(dados?.extra || {}), ab_bloco: ab } : (dados?.extra ?? null)
  fila.push({
    ...(recallAtual ? { recall_sinal: recallAtual.sinal, recall_marca: recallAtual.marca } : {}),
    ...dados,
    evento,
    extra,
    sessao: dados?.sessao ?? idDaSessao(),
    origem: dados?.origem ?? origemDaSessao() ?? null,
  })
  if (!ouvindoSaida && typeof window !== 'undefined') {
    ouvindoSaida = true
    window.addEventListener('pagehide', enviarFunil)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') enviarFunil()
    })
  }
  agendarEnvio()
}

/**
 * Espelha no nosso coletor as etapas do funil, a partir dos MESMOS parametros
 * que ja vao pro gtag. Evento fora da allowlist nao vai, e os campos que
 * viajam sao so os que a tabela entende: placa, sinal de leilao, plano e um
 * `extra` pequeno.
 *
 * Fica no escopo do modulo (e nao dentro do composable) porque pages/index.vue
 * tem um `track` local proprio, so de gtag, e precisa espelhar pelo mesmo
 * caminho sem herdar o espelho da Meta junto.
 */
export function espelharEventoNoFunil(event: string, params?: Record<string, any>) {
  if (!eventoPermitido(event)) return
  const extra: Record<string, string | number | boolean> = {}
  if (typeof params?.origin === 'string') extra.origem_cta = params.origin
  if (typeof params?.positivo === 'boolean') extra.positivo = params.positivo
  if (typeof params?.com_email === 'string') extra.com_email = params.com_email
  if (typeof params?.ja_consultada === 'boolean') extra.ja_consultada = params.ja_consultada
  enfileirarEventoFunil(event, {
    placa: typeof params?.placa === 'string' ? params.placa : null,
    leilao_sinal: typeof params?.leilao_sinal === 'string' ? params.leilao_sinal : undefined,
    recall_sinal: typeof params?.recall_sinal === 'string' ? params.recall_sinal : undefined,
    recall_marca: typeof params?.recall_marca === 'string' ? params.recall_marca : undefined,
    plano: typeof params?.plano === 'string' ? params.plano : null,
    extra: Object.keys(extra).length ? extra : null,
  })
}

/**
 * Composable para tracking de eventos com Google Analytics
 *
 * Fornece wrapper para envio de eventos ao GA4 via gtag
 *
 * @returns {Object} Objeto com função de tracking
 */
// Tokens que ja reportaram conversao NESTA aba. Fica fora do composable de
// proposito: cada chamada de useAnalytics cria um escopo novo, e o modal, a
// pagina do checkout e a do relatorio chamam cada um o seu.
const conversoesReportadas = new Set<string>()

/**
 * Decide se a conversao deste token ainda precisa ser reportada, e ja marca
 * que foi. Chamar DUAS vezes com o mesmo token devolve true so na primeira.
 *
 * Tres camadas, da mais forte pra mais fraca:
 * 1) memoria do processo, que pega o poll chamando em rajada dentro da mesma
 *    sessao mesmo quando o storage lanca (modo privado, cookies bloqueados) —
 *    antes disso, storage indisponivel significava conversao repetida a cada
 *    tick do poll;
 * 2) localStorage, que sobrevive ao reload e a revisita do relatorio;
 * 3) sessionStorage, rede de seguranca pra quando o localStorage esta cheio
 *    ou particionado mas o de sessao funciona.
 *
 * Exportada pra ser testavel sem gtag: e a regra que impede a mesma compra de
 * virar duas conversoes no Ads.
 */
export function reivindicarConversao(token: string): boolean {
  if (!token) return false
  if (conversoesReportadas.has(token)) return false
  conversoesReportadas.add(token)
  const key = 'pc_conv_' + token
  let jaFoi = false
  try { jaFoi = !!globalThis.localStorage?.getItem(key) } catch { /* storage indisponivel */ }
  if (!jaFoi) {
    try { jaFoi = !!globalThis.sessionStorage?.getItem(key) } catch { /* idem */ }
  }
  if (jaFoi) return false
  try { globalThis.localStorage?.setItem(key, '1') } catch { /* modo privado */ }
  try { globalThis.sessionStorage?.setItem(key, '1') } catch { /* idem */ }
  return true
}

/** So pra teste: esquece o que ja foi reportado nesta sessao. */
export function _limparConversoesReportadas() {
  conversoesReportadas.clear()
}

/**
 * Os quatro momentos que o remarketing precisa distinguir, traduzidos pros
 * nomes que a Meta entende. Evento fora deste mapa nao vai pro pixel: lista de
 * publico se faz com etapa de funil, nao com todo clique do site.
 */
export const EVENTOS_META: Record<string, string> = {
  consulta_success: 'Search',
  premium_checkout_open: 'InitiateCheckout',
  pix_gerado: 'AddPaymentInfo',
  purchase: 'Purchase',
}

export const useAnalytics = () => {
  /**
   * Envia evento para o Google Analytics
   *
   * Verifica se está no client-side e se gtag está disponível
   * antes de enviar o evento
   *
   * @param {string} event - Nome do evento a ser rastreado
   * @param {Record<string, any>} [params] - Parâmetros adicionais do evento
   *
   * @example
   * track('form_submit', { form_name: 'plate_consultation' })
   * track('button_click')
   */
  /**
   * Espelha no Pixel da Meta os quatro momentos que o remarketing precisa
   * distinguir. A Meta so entende os nomes dela, entao o mapa traduz; evento
   * fora do mapa nao vai, porque lista de publico se faz com etapa de funil,
   * nao com todo clique do site.
   *
   * Nada de identificavel atravessa: placa, chassi, e-mail, telefone e token
   * ficam de fora, so o valor e a moeda passam.
   *
   * Sumiu na refatoracao do funil (20/set) e derrubou o checkout inteiro:
   * ReferenceError no trackBeginCheckout antes do preview, tela presa em
   * "loading" por um dia. Fica aqui em cima do track() de proposito.
   */
  const espelharNaMeta = (event: string, params?: Record<string, any>) => {
    if (!import.meta.client) return
    const nome = EVENTOS_META[event]
    const fbq = (window as any).fbq
    if (!nome || typeof fbq !== 'function') return
    const dados: Record<string, any> = {}
    if (typeof params?.value === 'number') {
      dados.value = params.value
      dados.currency = 'BRL'
    }
    fbq('track', nome, dados)
  }

  const track = (event: string, params?: Record<string, any>) => {
    if (import.meta.client && window.gtag) {
      window.gtag('event', event, params)
    }
    espelharNaMeta(event, params)
    espelharEventoNoFunil(event, params)
  }

  /**
   * Restricao do relatorio que caiu no texto generico por nao ter copy
   * propria. Manda SO o codigo do tipo (ex: RESTRICAO_ADMINISTRATIVA_X),
   * nunca placa/chassi/token: serve pra saber quais tipos ainda faltam no
   * dicionario de explicacoes.
   */
  const trackRestricaoDesconhecida = (tipo: string) => {
    track('restricao_sem_copy', { tipo_restricao: tipo })
  }

  // Google Ads: acao de conversao "Consulta paga (Pix)", BRL.
  const AW_SEND_TO = 'AW-18330779331/KeCcCOXO7OMcEMP95aRE'

  /**
   * Resolve valor/item do plano a partir da fonte unica (shared/planos.ts).
   * O valor de conversao TEM que ser o preco real do plano (basica R$25,00,
   * completa R$39,90): o Ads otimiza os lances por esse numero, entao um valor
   * fixo pra todo mundo distorcia a otimizacao. `value` vai em reais.
   * Plano ausente/invalido cai em 'completa' (default historico do checkout).
   */
  const infoPlano = (plano?: string) => {
    const id = isPlanoPago(plano) ? plano : 'completa'
    const p = PLANOS[id]
    const value = p.valorCentavos / 100
    return {
      value,
      item: { item_id: `plano-${id}`, item_name: p.nome, price: value, quantity: 1 },
    }
  }

  /**
   * Clique no botao que gera a cobranca, disparado ANTES do POST do checkout.
   * Sem ele o funil do GA4 pulava de "abriu o modal" pra "pagou", entao a
   * tela de confirmacao, que e onde mais gente desiste, nao era mensuravel.
   * Nome padrao do funil de e-commerce do GA4, pros relatorios prontos
   * funcionarem sem configuracao.
   */
  const trackAddPaymentInfo = (plano?: string, placa?: string, valorCentavos?: number) => {
    const { value: valorTabela, item } = infoPlano(plano)
    const value = valorCentavos != null ? valorCentavos / 100 : valorTabela
    track('add_payment_info', {
      currency: 'BRL',
      value,
      payment_type: 'Pix',
      items: [{ ...item, price: value }],
      placa,
    })
  }

  /**
   * Cobranca Pix criada de verdade (resposta do checkout com brCode na mao).
   * add_payment_info marca a INTENCAO, antes da chamada; este marca o
   * resultado. A diferenca entre os dois e exatamente a taxa que o e-mail
   * fora da frente do Pix deveria melhorar, e sem os dois eventos ela so
   * existiria no banco, sem quebra por campanha ou dispositivo.
   */
  const trackPixGerado = (plano?: string, placa?: string, valorCentavos?: number, comEmail?: boolean) => {
    const { value: valorTabela, item } = infoPlano(plano)
    const value = valorCentavos != null ? valorCentavos / 100 : valorTabela
    track('pix_gerado', {
      currency: 'BRL',
      value,
      items: [{ ...item, price: value }],
      placa,
      // Permite comparar quem chegou ao Pix ja com e-mail e quem deixou pra
      // depois, que e a pergunta de produto por tras da mudanca.
      com_email: comEmail ? 'sim' : 'nao',
    })
  }

  /** Inicio do checkout pago (clique no CTA de pagar). Valor real por plano. */
  const trackBeginCheckout = (plano?: string, placa?: string) => {
    const { value, item } = infoPlano(plano)
    track('begin_checkout', { currency: 'BRL', value, items: [item], placa })
  }

  /**
   * Conversao do relatorio pago. Dispara UMA vez por pedido (token), quando o
   * pagamento e confirmado. Envia a conversao do Google Ads + o purchase do GA4
   * (receita/ecommerce e importacao) E o purchase do Bing UET (teste
   * head-to-head Google vs Bing). Idempotente via localStorage, MESMA chave
   * pros dois — uma unica gravacao cobre ambos, revisita nao duplica nenhum.
   * O `value` e o preco real do plano; o send_to do Ads segue inalterado.
   */
  /**
   * `valorPagoCentavos` sobrescreve o preco de tabela quando o que a pessoa
   * pagou de verdade e diferente (cupom): sem isso, um resgate GRATIS
   * reportaria o preco cheio do plano pro Ads/GA4, inflando ROAS com receita
   * que nunca existiu.
   */
  const trackConversionPaga = (token?: string, plano?: string, valorPagoCentavos?: number) => {
    if (!import.meta.client || !token) return
    // Homolog/staging: compra NUNCA vai pras tags (incidente 01/out: purchase
    // falso do homolog no Bing/GA4). Nem reivindica
    // o token, pra nao marcar como "ja reportado" algo que nao foi.
    if (!analyticsAtivoAqui()) return
    if (!reivindicarConversao(token)) return
    const { value: valorTabela, item } = infoPlano(plano)
    const value = valorPagoCentavos != null ? valorPagoCentavos / 100 : valorTabela
    if (window.gtag) {
      window.gtag('event', 'conversion', { send_to: AW_SEND_TO, value, currency: 'BRL', transaction_id: token })
      window.gtag('event', 'purchase', { transaction_id: token, value, currency: 'BRL', items: [{ ...item, price: value }] })
    }
    if (window.uetq) {
      window.uetq.push('event', 'purchase', { revenue_value: value, currency: 'BRL' })
    }
    // A compra nao passa pelo track() (ela fala direto com gtag e uetq, por
    // causa da dedupe por token), entao o espelho da Meta e chamado a mao aqui.
    espelharNaMeta('purchase', { value })
  }

  return {
    track,
    enfileirarEventoFunil,
    trackBeginCheckout,
    trackAddPaymentInfo,
    trackPixGerado,
    trackConversionPaga,
    trackRestricaoDesconhecida,
  }
}
