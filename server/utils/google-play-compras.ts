import crypto from 'node:crypto'
import { sanearOrigemCheckout } from '../../shared/origem-checkout'
import { sanearOrigem } from '../../shared/origem-trafego'
import type { CompraGoogle, EstadoGoogle, PedidoGoogle } from './google-play'

// Compras do app (Google Play) do comeco ao fim (Cesar, 18/out/2026).
//
// Tres compras reais mostraram o buraco: o servidor so ficava sabendo de uma
// compra se o app chamasse o /verificar NA HORA e a Google ja dissesse "pago".
//   - BAN0G13 (17/out): a versao publicada do app consome a compra no celular;
//     o servidor recusava "compra ja utilizada" e a venda paga sumia.
//   - BCY3E00 (18/out): Pix dentro da Play ficou ~2 min pendente; o app so
//     reenviaria ao reabrir, o cliente nao reabriu.
// Agora:
//   1. toda chamada grava/atualiza a compra em google_play_compras (comprovante);
//   2. compra paga vira pedido mesmo ja consumida (o purchaseToken e unique em
//      pedidos_premium: nao ha como a mesma compra virar dois pedidos);
//   3. compra pendente fica registrada e o job (rodarJobGooglePlay, a cada
//      2 min) conclui quando a Google disser "pago", pelo MESMO caminho
//      (concluirCompraPlay); desiste em 72 h e alerta;
//   4. a RTDN da Play registra compras cujo app nunca chamou o servidor;
//   5. compra que nao virou pedido em 10 min gera alerta por e-mail.

/** Preco da Consulta Completa na Play quando o orders.get nao responde (R$ 44,90 a partir de 20/out/2026). */
export const PRECO_PLAY_PADRAO_CENTAVOS = 4490
export const GP_NOME_LOCK = 'google-play-compras'
export const GP_INTERVALO_MS = 2 * 60 * 1000
/** Menor que o intervalo: o proximo tick (de qualquer container) pega de novo. */
export const GP_LEASE_S = 100
export const GP_DESISTE_MS = 72 * 60 * 60 * 1000
/** Token que a Google nao conhece: espera a propagacao (minutos) e desiste em 1 h, sem alerta. */
export const GP_DESISTE_NAO_ENCONTRADA_MS = 60 * 60 * 1000
export const GP_ALERTA_MS = 10 * 60 * 1000
export const GP_MAX_POR_RODADA = 30

/** Estados do orders.get em que o dinheiro voltou ou vai voltar: nao entrega. */
const PEDIDO_ESTORNADO = new Set(['CANCELED', 'REFUNDED', 'PENDING_REFUND', 'PARTIALLY_REFUNDED'])

const RE_PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/

/** Placa valida (antiga ou Mercosul) ou null. */
export function normalizarPlaca(v: unknown): string | null {
  const p = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return RE_PLACA.test(p) ? p : null
}

export interface EntradaCompra {
  purchaseToken: string
  productId: string
  orderId?: string | null
  placa?: string | null
  email?: string | null
  origem: 'app' | 'rtdn' | 'job'
  /** O que o app mandou alem do comprovante (preview, origin, origem_checkout, ambiente). */
  dadosApp?: Record<string, any> | null
  /** Campos da requisicao do app que vao direto pro pedido (ip, dispositivo). */
  extrasPedido?: Record<string, any>
}

export type ResultadoCompra =
  | { tipo: 'entregue'; token_entrega: string; repetido?: boolean; valor_centavos?: number }
  | { tipo: 'pendente' }
  | { tipo: 'recusada'; motivo: string; estado: EstadoGoogle | 'estornada' | 'bloqueada' }
  | { tipo: 'sem_placa' }

export interface DepsCompra {
  supabase: any
  consultar: (productId: string, purchaseToken: string) => Promise<CompraGoogle>
  consultarPedido: (orderId: string) => Promise<PedidoGoogle | null>
  processar: (supabase: any, pedido: any) => Promise<void>
  consumir: (productId: string, purchaseToken: string) => Promise<unknown>
  /** ambienteDaConsultaPaga(ambiente que o app mandou, config). */
  ambienteDoPedido: (ambienteApp: unknown) => string
  /** order_ids que nao viram pedido (estorno feito a mao). */
  ordensBloqueadas?: Set<string>
  agora?: number
}

const semVazios = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''))

/**
 * Grava a compra (ou completa a que ja existe). Nunca apaga o que ja se sabe:
 * a RTDN chega sem placa e nao pode apagar a placa que o app mandou.
 */
export async function registrarCompra(supabase: any, token: string, campos: Record<string, any>, origem: string, agora = Date.now()): Promise<any> {
  const agoraIso = new Date(agora).toISOString()
  const novos = semVazios(campos)
  const ler = async () => {
    const { data } = await supabase.from('google_play_compras').select('*').eq('purchase_token', token).maybeSingle()
    return data
  }
  const atual = await ler()
  if (atual) {
    const dados_app = novos.dados_app ? { ...(atual.dados_app || {}), ...novos.dados_app } : undefined
    const mudou = { ...novos, ...(dados_app ? { dados_app } : {}), atualizado_em: agoraIso }
    const { data } = await supabase.from('google_play_compras').update(mudou).eq('id', atual.id).select('*').maybeSingle()
    return data || { ...atual, ...mudou }
  }
  const { data, error } = await supabase.from('google_play_compras')
    .insert({ purchase_token: token, ...novos, origem, recebido_em: agoraIso, atualizado_em: agoraIso })
    .select('*').single()
  if (data) return data
  // Corrida com outra chamada do mesmo token (app + RTDN): a outra inseriu.
  const outra = await ler()
  if (outra) return registrarCompra(supabase, token, campos, origem, agora)
  throw new Error(`google_play_compras: ${error?.message || 'falha ao gravar'}`)
}

async function atualizarCompra(supabase: any, id: string, campos: Record<string, any>, agora: number) {
  try {
    await supabase.from('google_play_compras').update({ ...campos, atualizado_em: new Date(agora).toISOString() }).eq('id', id)
  } catch { /* o comprovante e best-effort depois de gravado; a entrega nao para por isso */ }
}

async function pedidoDoToken(supabase: any, token: string): Promise<{ id: string; token_entrega: string; valor_centavos?: number } | null> {
  const { data } = await supabase.from('pedidos_premium').select('id,token_entrega,valor_centavos').eq('google_play_purchase_token', token).maybeSingle()
  return data?.token_entrega ? data : null
}

/**
 * Leva uma compra do app ate o pedido entregue, se a Google disser que esta
 * paga. Mesmo caminho pro /verificar (app), pro job e pra RTDN. Idempotente:
 * chamar de novo com o mesmo token devolve o mesmo pedido.
 */
export async function concluirCompraPlay(e: EntradaCompra, deps: DepsCompra): Promise<ResultadoCompra> {
  const agora = deps.agora ?? Date.now()
  const sb = deps.supabase
  const linha = await registrarCompra(sb, e.purchaseToken, {
    product_id: e.productId,
    order_id: e.orderId,
    placa: normalizarPlaca(e.placa),
    email: e.email && e.email.includes('@') ? e.email : null,
    dados_app: e.dadosApp && Object.keys(semVazios(e.dadosApp)).length ? semVazios(e.dadosApp) : null,
  }, e.origem, agora)

  // Reenvio do mesmo comprovante: devolve o pedido que ja existe.
  const existente = await pedidoDoToken(sb, e.purchaseToken)
  if (existente) {
    if (linha.pedido_id !== existente.id) await atualizarCompra(sb, linha.id, { pedido_id: existente.id, motivo: null }, agora)
    return { tipo: 'entregue', token_entrega: existente.token_entrega, repetido: true }
  }

  const compra = await deps.consultar(e.productId, e.purchaseToken)
  const orderId = compra.orderId || e.orderId || linha.order_id || null
  const base = {
    estado_google: compra.estado,
    motivo: compra.motivo,
    order_id: orderId,
    tentativas: (Number(linha.tentativas) || 0) + 1,
    ...(compra.purchaseState !== null ? { teste: compra.teste } : {}),
  }

  if (orderId && deps.ordensBloqueadas?.has(orderId)) {
    await atualizarCompra(sb, linha.id, { ...base, motivo: 'bloqueada (tratada a mao)' }, agora)
    return { tipo: 'recusada', motivo: 'compra cancelada', estado: 'bloqueada' }
  }
  if (compra.estado === 'pendente') {
    await atualizarCompra(sb, linha.id, base, agora)
    return { tipo: 'pendente' }
  }
  if (!compra.ok) {
    await atualizarCompra(sb, linha.id, base, agora)
    return { tipo: 'recusada', motivo: compra.motivo || 'compra nao confirmada', estado: compra.estado }
  }

  const placa = normalizarPlaca(e.placa) || normalizarPlaca(linha.placa) || normalizarPlaca(compra.contaExterna)
  if (!placa) {
    await atualizarCompra(sb, linha.id, { ...base, motivo: 'paga, sem placa' }, agora)
    return { tipo: 'sem_placa' }
  }

  const pg = orderId ? await deps.consultarPedido(orderId) : null
  if (pg?.estado && PEDIDO_ESTORNADO.has(pg.estado)) {
    await atualizarCompra(sb, linha.id, { ...base, motivo: `pedido na Play ${pg.estado}` }, agora)
    return { tipo: 'recusada', motivo: 'compra cancelada', estado: 'estornada' }
  }
  const valor = pg?.valorCentavos ?? PRECO_PLAY_PADRAO_CENTAVOS

  const dados = { ...(linha.dados_app || {}), ...semVazios(e.dadosApp || {}) }
  const email = (e.email && e.email.includes('@') ? e.email : null) || linha.email || null
  const tokenEntrega = crypto.randomBytes(18).toString('base64url')
  const { data: pedido, error } = await sb.from('pedidos_premium')
    .insert({
      token_entrega: tokenEntrega,
      placa,
      placa_confirmada: true,
      origem_checkout: sanearOrigemCheckout(dados.origem_checkout),
      email,
      // Quem cobrou foi a loja: pix_provider e o que impede o estorno de bater
      // na AbacatePay; forma_pagamento e o que os relatorios de venda leem.
      pix_provider: 'google_play',
      forma_pagamento: 'google_play',
      google_play_purchase_token: e.purchaseToken,
      google_play_order_id: orderId,
      google_play_product_id: e.productId,
      status: 'pago',
      // Preco que a Play cobrou (orders.get), nunca o que o app mandou.
      valor_centavos: valor,
      plano: 'completa',
      preview: dados.preview || null,
      // Compra de teste da Play (purchaseType 0) fica fora das vendas.
      ambiente: compra.teste ? 'teste' : deps.ambienteDoPedido(dados.ambiente),
      ...(e.extrasPedido || {}),
      ...sanearOrigem(dados.origin),
    })
    .select()
    .single()

  if (error || !pedido) {
    // Corrida entre dois caminhos (app e job) com o mesmo comprovante: o unique
    // do banco barrou o segundo. Isso e sucesso: devolve o pedido que venceu.
    const corrida = await pedidoDoToken(sb, e.purchaseToken)
    if (corrida) {
      await atualizarCompra(sb, linha.id, { ...base, pedido_id: corrida.id, motivo: null }, agora)
      return { tipo: 'entregue', token_entrega: corrida.token_entrega, repetido: true }
    }
    await atualizarCompra(sb, linha.id, { ...base, motivo: `falha ao criar pedido: ${String(error?.message || '').slice(0, 120)}` }, agora)
    throw new Error('Falha ao criar pedido')
  }

  await atualizarCompra(sb, linha.id, {
    ...base, motivo: null, pedido_id: pedido.id, placa, valor_centavos: valor, liquido_centavos: pg?.liquidoCentavos ?? null,
  }, agora)

  // Entrega em segundo plano (a tela acompanha por /api/premium/status) e,
  // quando termina, consome a compra pra pessoa poder comprar outra placa.
  // Ja consumida no celular: nada a consumir.
  deps.processar(sb, pedido)
    .catch(() => {})
    .finally(() => { if (!compra.consumida) Promise.resolve(deps.consumir(e.productId, e.purchaseToken)).catch(() => {}) })

  return { tipo: 'entregue', token_entrega: tokenEntrega, valor_centavos: valor }
}

// ------------------------------------------------------------------ job

export interface DepsJob extends DepsCompra {
  dono: string
  log?: (m: string) => void
  /** Manda o e-mail de alerta (texto pronto). Nunca deve lancar. */
  alertar: (assunto: string, linhas: string[]) => Promise<unknown>
}

export interface ResumoJob {
  rodou: boolean
  motivo?: string
  vistas: number
  entregues: number
  desistencias: number
  alertas: number
}

export function descreverCompra(l: any): string {
  return [
    `order_id=${l.order_id || '?'}`,
    `placa=${l.placa || 'sem placa'}`,
    `estado_google=${l.estado_google || '?'}`,
    `motivo=${l.motivo || '?'}`,
    `origem=${l.origem || '?'}`,
    `teste=${l.teste === true ? 'sim' : l.teste === false ? 'nao' : '?'}`,
    `recebido_em=${l.recebido_em}`,
    `tentativas=${l.tentativas ?? 0}`,
  ].join(' | ')
}

/**
 * Uma rodada: conclui as compras sem pedido, desiste das velhas e alerta as
 * que passaram de 10 min sem virar pedido. Lock entre containers igual ao
 * fotos-depois (job_lock_pegar). Nunca lanca.
 */
export async function rodarJobGooglePlay(deps: DepsJob): Promise<ResumoJob> {
  const agora = deps.agora ?? Date.now()
  const log = deps.log ?? ((m: string) => console.info(m))
  const sb = deps.supabase
  const r: ResumoJob = { rodou: false, vistas: 0, entregues: 0, desistencias: 0, alertas: 0 }

  try {
    const { data, error } = await sb.rpc('job_lock_pegar', { p_nome: GP_NOME_LOCK, p_dono: deps.dono, p_segundos: GP_LEASE_S })
    if (error) throw new Error(error.message)
    if (data !== true) return { ...r, motivo: 'lock com outro container' }
  } catch (e: any) {
    log(`[google-play] sem lock (${String(e?.message || e).slice(0, 120)}): rodada pulada`)
    return { ...r, motivo: 'lock indisponivel' }
  }
  r.rodou = true

  const desistidas: any[] = []
  try {
    const { data: abertas, error } = await sb.from('google_play_compras')
      .select('*')
      .is('pedido_id', null)
      .is('desistiu_em', null)
      .order('recebido_em', { ascending: true })
      .limit(GP_MAX_POR_RODADA)
    if (error) throw new Error(error.message)

    for (const l of abertas || []) {
      r.vistas++
      const idade = agora - new Date(l.recebido_em).getTime()
      if (idade > GP_DESISTE_MS) {
        await atualizarCompra(sb, l.id, { desistiu_em: new Date(agora).toISOString(), motivo: `sem pedido em 72 h (ultimo: ${l.motivo || l.estado_google || '?'})` }, agora)
        desistidas.push({ ...l, motivo: `sem pedido em 72 h (ultimo: ${l.motivo || l.estado_google || '?'})` })
        r.desistencias++
        continue
      }
      try {
        const res = await concluirCompraPlay({
          purchaseToken: l.purchase_token,
          productId: l.product_id || 'consulta_completa',
          origem: 'job',
        }, { ...deps, agora })
        if (res.tipo === 'entregue') {
          r.entregues++
          log(`[google-play] job concluiu ${l.order_id || l.id}: ${res.repetido ? 'pedido ja existia' : 'pedido criado'}`)
        } else if (res.tipo === 'recusada' && (res.estado === 'cancelada' || res.estado === 'estornada' || res.estado === 'bloqueada'
          || (res.estado === 'nao_encontrada' && idade > GP_DESISTE_NAO_ENCONTRADA_MS))) {
          // Nada mais vai mudar: para de perguntar a Google.
          await atualizarCompra(sb, l.id, { desistiu_em: new Date(agora).toISOString() }, agora)
          r.desistencias++
        }
      } catch (e: any) {
        log(`[google-play] job falhou em ${l.order_id || l.id}: ${String(e?.message || e).slice(0, 160)}`)
      }
    }
  } catch (e: any) {
    log(`[google-play] rodada falhou: ${String(e?.message || e).slice(0, 160)}`)
  }

  // Alerta: toda compra que nao virou pedido em 10 min (uma vez por compra).
  // Token que a Google nao conhece fica de fora: e lixo (ou ainda propagando).
  try {
    const limite = new Date(agora - GP_ALERTA_MS).toISOString()
    const { data: atrasadas } = await sb.from('google_play_compras')
      .select('*')
      .is('pedido_id', null)
      .is('alerta_em', null)
      .lt('recebido_em', limite)
      .order('recebido_em', { ascending: true })
      .limit(50)
    const alertar = (atrasadas || []).filter((l: any) => l.estado_google !== 'nao_encontrada')
    if (alertar.length) {
      await deps.alertar(`COMPRA NO APP SEM PEDIDO HA MAIS DE 10 MIN (${alertar.length})`, alertar.map(descreverCompra))
      for (const l of alertar) await atualizarCompra(sb, l.id, { alerta_em: new Date(agora).toISOString() }, agora)
      r.alertas += alertar.length
    }
  } catch (e: any) {
    log(`[google-play] alerta falhou: ${String(e?.message || e).slice(0, 160)}`)
  }
  if (desistidas.length) {
    try {
      await deps.alertar(`COMPRA NO APP: DESISTIMOS APOS 72 H (${desistidas.length}). Tratar a mao no Play Console.`, desistidas.map(descreverCompra))
      r.alertas += desistidas.length
    } catch { /* idem */ }
  }
  return r
}

/**
 * GOOGLE_PLAY_ORDENS_BLOQUEADAS: order_ids (GPA...) separados por virgula que
 * nunca viram pedido, porque o Cesar ja tratou a mao (ex.: BAN0G13, estornada
 * em 18/out/2026). Depois do estorno o orders.get ja diz REFUNDED; a lista
 * cobre a janela ate la.
 */
export function ordensBloqueadasDoEnv(v = process.env.GOOGLE_PLAY_ORDENS_BLOQUEADAS): Set<string> {
  return new Set(String(v || '').split(',').map((s) => s.trim()).filter(Boolean))
}

/** message.data (base64) -> DeveloperNotification, ou null. */
export function decodificarRtdn(body: any): any | null {
  const data = body?.message?.data
  if (typeof data !== 'string' || !data) return null
  try { return JSON.parse(Buffer.from(data, 'base64').toString('utf8')) } catch { return null }
}
