import { sanearOrigemCheckout, ROTULO_ORIGEM_CHECKOUT } from '../../shared/origem-checkout'
import { ambienteForaDeProd } from './ambiente-alerta'

// Aviso de venda ao Cesar, NA HORA da entrega (antes saia so pelo timer
// pc-venda-origem, a cada 20 min). Mesmo conteudo do script do host: origem
// (Google/Bing/ChatGPT/organico + cupom de recompra), placa, plano, valor,
// pagamento, canal, dispositivo, link, entrega, A/B e o que a pessoa viu na
// consulta gratis (sinal de leilao e de recall).
//
// Sem CPF e sem hash de pagador no e-mail. O e-mail do comprador vai, como ia.
// Recompra: o hash do pagador (Pix) ou o fingerprint do cartao so e usado pra
// achar compras anteriores da mesma pessoa; no e-mail vai so a contagem, a data
// e a origem da 1a compra (o anuncio que trouxe o cliente).
//
// Dedup: pedidos_premium.aviso_venda_em. Quem marca primeiro (este codigo ou o
// timer do host, que virou rede de seguranca) envia; o outro pula. Envio que
// falha desmarca, e o timer cobre depois.
//
// Fail-open e fora do caminho: quem chama dispara sem await. Nada aqui atrasa
// ou quebra a entrega.

export const DESTINO_AVISO_VENDA = 'cesarcbhering@gmail.com'
const REMETENTE = 'Helena PlacaCompleta <helena@placacompleta.com.br>'

export interface PedidoAviso {
  id: string
  placa: string
  plano?: string | null
  valor_centavos?: number | null
  pago_em?: string | null
  email?: string | null
  token_entrega?: string | null
  status?: string | null
  entregue_em?: string | null
  erro?: string | null
  dispositivo?: string | null
  sistema?: string | null
  pix_provider?: string | null
  forma_pagamento?: string | null
  canal?: string | null
  recall_sinal?: string | null
  recall_marca?: string | null
  cupom_origem?: string | null
  /** Botao que abriu o checkout (shared/origem-checkout.ts); nulo = antes da medicao. */
  origem_checkout?: string | null
  /** So pra achar compras anteriores; nunca vai pro e-mail. */
  pagador_hash?: string | null
  pagador_hash_cartao?: string | null
}

export interface ConsultaOrigem {
  gclid?: string | null
  msclkid?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  oppref?: string | null
}

export function brlCentavos(centavos: unknown): string {
  const n = Number(centavos)
  if (!Number.isFinite(n)) return '?'
  return `R$ ${(n / 100).toFixed(2).replace('.', ',')}`
}

/** Mesma regra do pc-venda-origem: ChatGPT > Google (gclid) > Bing > e-mail > utm > organico. */
export function origemDaConsulta(row: ConsultaOrigem | null | undefined): string {
  if (!row) return 'Indeterminada (sem consulta associada)'
  const src = String(row.utm_source || '').toLowerCase()
  const med = String(row.utm_medium || '').toLowerCase()
  const camp = row.utm_campaign || ''
  const comCamp = (base: string) => `${base}${camp ? ` / ${camp}` : ''}`
  if (row.oppref || src === 'chatgpt_ads') return comCamp('ChatGPT Ads (OpenAI)')
  if (row.gclid) return comCamp('Google Ads')
  if (row.msclkid || src === 'bing' || src === 'microsoft' || med.includes('msclk')) return comCamp('Bing Ads')
  if (src === 'email') return `E-mail marketing (${camp || 'sem campanha'})`
  if (src) return comCamp(src)
  return 'Organico (direto/SEO, sem marca de anuncio)'
}

export function origemDoPedido(pedido: Pick<PedidoAviso, 'cupom_origem'>, consulta: ConsultaOrigem | null | undefined): string {
  const base = origemDaConsulta(consulta)
  return pedido.cupom_origem === 'cupom_recompra' ? `${base} + cupom de recompra` : base
}

/** "Bloco da oferta", "Barra fixa"... ou "não medido" (pedido de antes de 13/out). */
export function botaoDoPedido(p: Pick<PedidoAviso, 'origem_checkout'>): string {
  const o = sanearOrigemCheckout(p.origem_checkout)
  return ROTULO_ORIGEM_CHECKOUT[o ?? 'nao_medido']
}

export function formaPagamento(p: PedidoAviso): string {
  if (p.forma_pagamento === 'cartao') return 'Cartao (Stripe)'
  if (p.pix_provider === 'google_play') return 'Google Play'
  return `Pix (${p.pix_provider || '?'})`
}

export function canalDoPedido(p: PedidoAviso): string {
  if (p.canal) return p.canal
  return p.pix_provider === 'google_play' ? 'APP Android (Google Play)' : 'web (Pix)'
}

export function entregaDoPedido(p: PedidoAviso): { link: string; estado: string } {
  const link = p.token_entrega ? `https://placacompleta.com.br/premium/${p.token_entrega}` : '(sem token)'
  let estado: string
  if (p.status === 'entregue') estado = `entregue em ${p.entregue_em} UTC`
  else if (p.erro) estado = `ERRO: ${String(p.erro).slice(0, 200)}`
  else estado = `status=${p.status || '?'} (ainda nao entregue)`
  return { link, estado }
}

const ROT_LEILAO: Record<string, string> = {
  positivo: 'SIM, viu o sinal de leilao',
  negativo: 'nao (consulta sem leilao)',
  sem_sinal: 'sem sinal (consulta nao respondeu)',
}
const ROT_RECALL: Record<string, string> = {
  firme: 'SIM, viu (chassi na faixa da campanha)',
  suave: 'SIM, viu (modelo/ano com campanha)',
  negativo: 'nao (marca com base, sem campanha)',
  fora_escopo: 'nao (marca sem base de recall)',
  sem_sinal: 'sem sinal (consulta nao respondeu)',
}

export function rotuloLeilao(sinal: string | null | undefined): string {
  return sinal ? (ROT_LEILAO[sinal] || sinal) : 'sem registro (venda sem evento do funil)'
}

export function rotuloRecall(sinal: string | null | undefined, marca?: string | null): string {
  if (!sinal) return 'sem registro (antes da medicao de 01/out ou sem evento)'
  return (ROT_RECALL[sinal] || sinal) + (marca ? ` [${marca}]` : '')
}

export interface ExtrasAviso {
  consulta: ConsultaOrigem | null
  ab: string | null
  leilaoSinal: string | null
  recallSinal: string | null
  recallMarca: string | null
  recompra?: Recompra | null
}

/** Compras anteriores do mesmo pagador (Pix: pagador_hash; cartao: fingerprint). */
export interface Recompra {
  /** false = pedido sem identificador do pagador (ainda nao gravado ou meio sem documento). */
  identificado: boolean
  anteriores: number
  primeira: { pago_em: string | null; origem: string } | null
}

function dataBR(iso: string | null | undefined): string {
  const t = iso ? new Date(iso) : null
  if (!t || Number.isNaN(t.getTime())) return '?'
  return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function linhaRecompra(r: Recompra | null | undefined): string {
  if (!r || !r.identificado) return 'Recompra: sem identificador do pagador (nao da pra saber)'
  if (!r.anteriores) return 'Recompra: nao, 1a compra deste pagador'
  const ord = `${r.anteriores + 1}a compra do mesmo pagador`
  const p = r.primeira
  return p ? `Recompra: SIM, ${ord}. 1a compra em ${dataBR(p.pago_em)}, origem: ${p.origem}` : `Recompra: SIM, ${ord}`
}

export function montarAvisoVenda(p: PedidoAviso, x: ExtrasAviso): { subject: string; text: string } {
  const org = origemDoPedido(p, x.consulta)
  const { link, estado } = entregaDoPedido(p)
  const curta = org.split(' (')[0].split(' /')[0]
  const subject = `Venda: ${curta} - ${p.placa}`
    + (x.recompra?.anteriores ? ' [RECOMPRA]' : '')
    + (p.pix_provider === 'google_play' ? ' [APP]' : '')
    + (p.forma_pagamento === 'cartao' ? ' [CARTAO]' : '')
  const text = [
    'Venda confirmada.',
    '',
    `Origem: ${org}`,
    linhaRecompra(x.recompra),
    '',
    `Placa: ${p.placa}`,
    `Plano: ${p.plano || '?'}`,
    `Valor: ${brlCentavos(p.valor_centavos)}`,
    `Pago em: ${p.pago_em || '?'} UTC`,
    `E-mail do comprador: ${p.email || ''}`,
    `Pagamento: ${formaPagamento(p)}`,
    `Canal: ${canalDoPedido(p)}`,
    `Botão: ${botaoDoPedido(p)}`,
    `Dispositivo: ${p.dispositivo || '?'} / ${p.sistema || '?'}`,
    '',
    `Relatorio: ${link}`,
    `Entrega: ${estado}`,
    `Teste A/B do bloco: ${x.ab || 'sem_ab (evento sem variante)'}`,
    `Viu sinal de leilao na consulta gratis: ${rotuloLeilao(x.leilaoSinal)}`,
    `Viu sinal de recall na consulta gratis: ${rotuloRecall(x.recallSinal, x.recallMarca)}`,
    '',
    '(Atribuicao pelo nosso banco: consultas.gclid/msclkid/utm_source. '
      + 'Google = gclid; Bing = msclkid ou utm_source=bing; e-mail marketing = '
      + 'utm_source=email; senao, organico. Enviado na hora da entrega.)',
  ].join('\n')
  return { subject, text }
}

const COLS_PEDIDO = 'id,placa,plano,valor_centavos,pago_em,email,consulta_id,token_entrega,status,entregue_em,erro,'
  + 'dispositivo,sistema,pix_provider,forma_pagamento,canal,recall_sinal,recall_marca,cupom_origem,ambiente,'
  + 'pagador_hash,pagador_hash_cartao,origem_checkout'

const HASH_OK = /^[A-Za-z0-9]{8,128}$/
const ORIGEM_PEDIDO = 'gclid,msclkid,utm_source,utm_medium,utm_campaign,oppref'

/**
 * Compras pagas ANTERIORES do mesmo pagador em prod. Origem da 1a compra: a
 * gravada no proprio pedido (desde 02/set); sem ela, a da consulta gratis.
 */
export async function recompraDoPedido(supabase: any, supabaseConsultas: any, p: any): Promise<Recompra | null> {
  try {
    const filtros = [
      HASH_OK.test(p.pagador_hash || '') ? `pagador_hash.eq.${p.pagador_hash}` : null,
      HASH_OK.test(p.pagador_hash_cartao || '') ? `pagador_hash_cartao.eq.${p.pagador_hash_cartao}` : null,
    ].filter(Boolean)
    if (!filtros.length) return { identificado: false, anteriores: 0, primeira: null }
    if (!p.pago_em) return null
    const { data, error } = await supabase.from('pedidos_premium')
      .select(`id,placa,pago_em,consulta_id,${ORIGEM_PEDIDO}`)
      .or(filtros.join(','))
      .eq('ambiente', 'producao')
      .neq('id', p.id)
      .neq('status', 'reembolsado')
      .not('pago_em', 'is', null)
      .lt('pago_em', p.pago_em)
      .order('pago_em', { ascending: true })
      .limit(50)
    if (error) return null
    const lista = Array.isArray(data) ? data : []
    if (!lista.length) return { identificado: true, anteriores: 0, primeira: null }
    const prim = lista[0]
    const temMarca = ORIGEM_PEDIDO.split(',').some((c) => prim[c])
    const origem = origemDaConsulta(temMarca ? prim : await consultaDoPedido(supabaseConsultas, prim))
    return { identificado: true, anteriores: lista.length, primeira: { pago_em: prim.pago_em ?? null, origem } }
  } catch { return null }
}

async function consultaDoPedido(supabaseConsultas: any, p: any): Promise<ConsultaOrigem | null> {
  // msclkid pode nao existir em algum ambiente: tenta com, cai pra sem.
  for (const cols of ['gclid,msclkid,utm_source,utm_medium,utm_campaign,oppref', 'gclid,utm_source,utm_medium,utm_campaign,oppref']) {
    try {
      if (p.consulta_id) {
        const { data, error } = await supabaseConsultas.from('consultas').select(cols).eq('id', p.consulta_id).maybeSingle()
        if (error) continue
        if (data) return data
      }
      if (!p.pago_em) return null
      const { data, error } = await supabaseConsultas.from('consultas').select(cols)
        .ilike('placa', p.placa).lte('created_at', p.pago_em)
        .order('created_at', { ascending: false }).limit(1)
      if (error) continue
      return data?.[0] || null
    } catch { /* tenta o proximo */ }
  }
  return null
}

async function ultimoEvento(supabase: any, p: any, coluna: string, cols: string): Promise<any | null> {
  try {
    const { data } = await supabase.from('eventos_funil').select(cols)
      .ilike('placa', p.placa).lte('criado_em', p.pago_em)
      .not(coluna, 'is', null)
      .order('criado_em', { ascending: false }).limit(10)
    const lista = Array.isArray(data) ? data : []
    // Mesma preferencia do script: um sinal de verdade vence o "sem_sinal".
    return lista.find((r: any) => r[coluna] !== 'sem_sinal') || lista[0] || null
  } catch { return null }
}

async function extrasDoPedido(supabase: any, supabaseConsultas: any, p: any): Promise<ExtrasAviso> {
  const [consulta, abEv, leilaoEv, recallEv, recompra] = await Promise.all([
    consultaDoPedido(supabaseConsultas, p),
    p.pago_em ? ultimoEvento(supabase, p, 'extra->>ab_bloco', 'extra') : null,
    p.pago_em ? ultimoEvento(supabase, p, 'leilao_sinal', 'leilao_sinal') : null,
    !p.recall_sinal && p.pago_em ? ultimoEvento(supabase, p, 'recall_sinal', 'recall_sinal,recall_marca') : null,
    recompraDoPedido(supabase, supabaseConsultas, p),
  ])
  return {
    consulta,
    ab: abEv?.extra?.ab_bloco ?? null,
    leilaoSinal: leilaoEv?.leilao_sinal ?? null,
    recallSinal: p.recall_sinal || recallEv?.recall_sinal || null,
    recallMarca: p.recall_sinal ? (p.recall_marca ?? null) : (recallEv?.recall_marca ?? null),
    recompra,
  }
}

/**
 * Envia o aviso da venda `pedidoId` se ninguem enviou ainda. Devolve true se
 * enviou. Nunca lanca.
 */
export async function avisarVenda(
  supabase: any,
  pedidoId: string,
  deps: { supabaseConsultas?: any; config?: any; enviar?: (msg: { from: string; to: string[]; subject: string; text: string }) => Promise<void> } = {},
): Promise<boolean> {
  let marcou = false
  try {
    const config = deps.config ?? useRuntimeConfig()
    // So prod avisa: homolog/staging nao e venda.
    if (ambienteForaDeProd(config)) return false
    if (!deps.enviar && !config.resendApiKey) return false

    // Marca primeiro (atomico): so quem trocar null por agora envia.
    const agora = new Date().toISOString()
    const { data: marcados, error } = await supabase.from('pedidos_premium')
      .update({ aviso_venda_em: agora })
      .eq('id', pedidoId)
      .eq('ambiente', 'producao')
      .is('aviso_venda_em', null)
      .select(COLS_PEDIDO)
    if (error || !marcados?.length) return false
    marcou = true
    const p = marcados[0]

    const extras = await extrasDoPedido(supabase, deps.supabaseConsultas ?? useSupabaseServer(), p)
    const { subject, text } = montarAvisoVenda(p, extras)
    const msg = { from: REMETENTE, to: [DESTINO_AVISO_VENDA], subject, text }
    if (deps.enviar) await deps.enviar(msg)
    else {
      await $fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: msg,
        timeout: 10000,
      })
    }
    return true
  } catch (e: any) {
    // Desmarca: o timer do host (rede de seguranca) manda depois.
    if (marcou) {
      try { await supabase.from('pedidos_premium').update({ aviso_venda_em: null }).eq('id', pedidoId) } catch { /* timer cobre */ }
    }
    console.warn('[aviso-venda] falhou, o timer do host cobre:', e?.message || e)
    return false
  }
}
