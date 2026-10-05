// Reserva de hash GCC (1 hash de frente; so compra quando a reserva zera). Este arquivo comeca pelo pedaco
// puro e testavel: ler o exp do JWT do hash pra saber ate quando ele vale. O
// repositor e o consumo entram depois (dependem do fluxo GCC do senatran-consulta).

/**
 * Le a validade (claim `exp` ou, no hash do GCC, `dataExpiracao`) do payload de um JWT SEM validar assinatura
 * — so pra saber a validade do hash de consentimento. Devolve Date ou null se
 * o token nao for um JWT decodificavel ou nao tiver exp numerico.
 *
 * Nao valida assinatura de proposito: o hash ja veio do GCC autenticado; aqui
 * so queremos a data de expiracao pra reserva (o consumo tem margem de 1h).
 */
export function expDoHashJwt(hash: string | null | undefined): Date | null {
  const s = String(hash || '')
  const partes = s.split('.')
  if (partes.length < 2) return null
  try {
    // base64url -> base64 -> JSON
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8')
    const payload = JSON.parse(json)
    const exp = payload?.exp
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      const d = new Date(exp * 1000)
      return Number.isNaN(d.getTime()) ? null : d
    }
    // O hash real do GCC NAO tem `exp`: a validade vem em `dataExpiracao`,
    // horario de Brasilia SEM fuso ("2026-09-30T21:46:48", 24h apos
    // `dataCriacao`). Visto no smoke do homolog em 29/set.
    const m = String(payload?.dataExpiracao || '').match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
    if (m) {
      const d = new Date(`${m[1]}-03:00`)
      return Number.isNaN(d.getTime()) ? null : d
    }
    return null
  } catch {
    return null
  }
}

/**
 * Validade a gravar na reserva: o exp real do JWT quando der pra ler; senao um
 * fallback conservador de agora+24h (TTL confirmado do hash GCC). Assim a
 * reserva nunca fica sem expira_em, e quando o exp existe usamos o valor exato.
 */
export function validadeDaReserva(hash: string | null | undefined, agora: Date = new Date()): Date {
  return expDoHashJwt(hash) ?? new Date(agora.getTime() + 24 * 60 * 60 * 1000)
}

/**
 * Reserva alvo: 1 hash de frente (regra do Cesar, 05/out). So compra quando a
 * reserva ZERA de hash utilizavel. Com 2 de frente e 3 a 5 vendas por dia,
 * sobravam hashes que venciam sem uso (~R$7 cada). O 1 que fica pronto evita
 * depender do GCC (lento/fora) na hora da venda.
 */
export const RESERVA_ALVO = 1

/** Margem de vida minima pra consumir/contar um hash de reserva (1h). */
const MARGEM_MS = 60 * 60 * 1000
/**
 * Vida minima pra um hash da reserva servir a uma venda: 10 min (era 1h). A
 * consulta leva segundos; com 1h, um hash com 21 min de vida foi pulado e
 * venceu sem uso (GCC id 41502, 03/out). Mesmo valor no SQL do claim.
 */
export const MARGEM_CONSUMO_MS = 10 * 60 * 1000

/** Destino do alerta de GCC fora (mesma caixa do estorno automatico). */
const AVISO_GCC = 'cesarcbhering@gmail.com'

type Ambiente = 'homolog' | 'producao'

/**
 * Ambiente pedido no corpo do POST da reserva. SEM default: o staging tem chave
 * GCC de producao ativa, e um POST sem ambiente num container de homolog
 * comprava hash real (~R$7). Qualquer coisa fora de 'producao'|'homolog' -> null
 * (o endpoint responde 400). O timer de prod manda 'producao' explicito.
 */
export function ambienteDoCorpo(body: any): Ambiente | null {
  const a = body?.ambiente
  return a === 'producao' || a === 'homolog' ? a : null
}

/**
 * Ambiente GCC/SERPRO de uma consulta paga, decidido pelo BUILD e nunca so
 * pelo cliente. Fora do homolog e sempre 'producao' (o valor pedido e
 * ignorado). No homolog e 'homolog', e so vira 'producao' (hash REAL, ~R$7)
 * quando o pedido escolheu isso E a env NUXT_HOMOLOG_GCC_PRODUCAO=on estiver
 * ligada no container. Desligada por padrao: o staging tem a chave GCC de prod
 * ativa, e um clique no dropdown comprava hash real.
 */
export function ambienteDaConsultaPaga(
  pedido: unknown,
  config: { homologGccProducao?: unknown; public?: { homolog?: unknown } },
): Ambiente {
  if (!config?.public?.homolog) return 'producao'
  const liberado = String(config?.homologGccProducao ?? '').trim().toLowerCase() === 'on'
  return pedido === 'producao' && liberado ? 'producao' : 'homolog'
}

/**
 * Repor a reserva deste ambiente neste build? Nunca a de 'producao' no
 * homolog: o repositor compraria hash real pro banco staging que ficariam
 * parados ate vencer (~R$14), so porque alguem testou uma consulta de prod.
 */
export function podeReporReserva(ambiente: Ambiente, config: { public?: { homolog?: unknown } }): boolean {
  return !(config?.public?.homolog && ambiente === 'producao')
}

/**
 * Reivindica ATOMICAMENTE 1 hash da reserva pra uma venda (RPC com
 * `for update skip locked`: dois pedidos concorrentes nunca pegam o mesmo).
 * Devolve { id, numero_hash_consulta, api_key_id } ou null se a reserva estiver
 * vazia. Fail-open: erro vira null (a venda cai no fluxo de gerar hash na hora).
 */
export async function reivindicarReserva(
  supabase: any,
  ambiente: Ambiente,
): Promise<{ id: string; numero_hash_consulta: string; api_key_id: string | null } | null> {
  try {
    const { data, error } = await supabase.rpc('reivindicar_hash_reserva', { p_ambiente: ambiente })
    if (error) { console.warn('[gcc-reserva] claim falhou:', error.message); return null }
    const row = Array.isArray(data) ? data[0] : data
    return row?.numero_hash_consulta ? row : null
  } catch (e: any) {
    console.warn('[gcc-reserva] claim excecao:', e?.message || e)
    return null
  }
}

/**
 * Gera UM hash de consentimento no GCC (mesmo POST do senatran-consulta). Usado
 * so pelo repositor da reserva. Devolve o hash (ou null quando o GCC enfileira
 * sem devolver: "03 Enfileirado", 401, 5xx) + http + corpo cru.
 */
async function gerarHashConsentimento(
  env: { gccBase: string; cnpj: string; template: string },
  apiKey: string,
): Promise<{ hash: string | null; http: number; raw: any }> {
  try {
    const res = await fetch(`${env.gccBase}/consentimentos-ciencias`, {
      method: 'POST',
      headers: { accept: 'application/json', 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo_titular: null, cpf_cnpj: '', tipo_de_usuario: 1, cnpj_provedor: String(env.cnpj), template_id: String(env.template) }),
    })
    const text = await res.text()
    let raw: any = {}
    try { raw = JSON.parse(text) } catch { /* corpo nao-JSON */ }
    return { hash: findHash(raw), http: res.status, raw }
  } catch (e: any) {
    return { hash: null, http: 0, raw: { erro: String(e?.message || e) } }
  }
}

/**
 * Quantos hashes de reserva UTILIZAVEIS existem pro ambiente: o mesmo criterio
 * do claim da venda (expira_em > agora + 10 min). Regra do Cesar: nunca comprar
 * hash novo enquanto existir um valido nao usado. Um hash com menos de 10 min de
 * vida nao serve mais pra venda (o claim pula), entao nao segura a reposicao.
 */
export function limiteUtilizavel(agora: Date = new Date()): string {
  return new Date(agora.getTime() + MARGEM_CONSUMO_MS).toISOString()
}

async function contarReserva(supabase: any, ambiente: Ambiente): Promise<number> {
  const { count } = await supabase
    .from('gcc_consentimentos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'reserva')
    .eq('ambiente', ambiente)
    .gt('expira_em', limiteUtilizavel())
  return count || 0
}

/**
 * Marca como 'vencido' as reservas que expiraram sem uso e devolve quantas —
 * pra medir desperdicio (cada hash custa ~R$7). Chamado pelo timer/endpoint.
 */
export async function limparReservaVencida(supabase: any, ambiente: Ambiente): Promise<number> {
  const { data } = await supabase
    .from('gcc_consentimentos')
    .update({ status: 'vencido' })
    .eq('status', 'reserva')
    .eq('ambiente', ambiente)
    .lte('expira_em', new Date().toISOString())
    .select('id')
  const n = data?.length || 0
  if (n > 0) console.warn(`[gcc-reserva] ${n} hash(es) de reserva venceram sem uso (${ambiente}) — desperdicio ~R$${n * 7}`)
  return n
}

/**
 * Repoe a reserva so quando ela ZERA, ate o alvo (1), gerando hash no GCC. Teto DURO: no maximo
 * RESERVA_ALVO POSTs por run. Para no primeiro erro do GCC (nao insiste, pra nao
 * empilhar chamadas quando o GCC esta fora). Atualiza a saude + dispara o alerta.
 * Fail-open pelo chamador: nunca lanca (a venda nao depende disto).
 */
export async function reporReservaGcc(
  supabase: any,
  ambiente: Ambiente,
): Promise<{ criados: number; reservaAtual: number; gccOk: boolean }> {
  if (!podeReporReserva(ambiente, useRuntimeConfig())) {
    console.warn('[gcc-reserva] homolog nao repoe reserva de producao (hash real)')
    return { criados: 0, reservaAtual: 0, gccOk: true }
  }
  const agora = new Date()
  let count = await contarReserva(supabase, ambiente)
  let criados = 0
  let gccOk = true
  let ultimoHttp = 0

  const env = configPorAmbiente(useRuntimeConfig(), ambiente)
  const chaves = await chavesCandidatas(supabase, ambiente)
  const chave = chaves[0] || null

  while (count < RESERVA_ALVO) {
    if (!chave?.api_key || !env.gccBase) { gccOk = false; break }
    const r = await gerarHashConsentimento(env, chave.api_key)
    ultimoHttp = r.http
    if (!r.hash) { gccOk = false; break } // "03 Enfileirado"/401/5xx: GCC nao gerou
    const expira = validadeDaReserva(r.hash, agora).toISOString()
    const { error } = await supabase.from('gcc_consentimentos').insert({
      numero_hash_consulta: r.hash, status: 'reserva', ambiente,
      api_key_id: chave.id, placa: null, expira_em: expira, raw_response: r.raw,
    })
    if (error) { console.warn('[gcc-reserva] insert reserva falhou:', error.message); break }
    criados++
    count++
  }

  await registrarSaudeGcc(supabase, ambiente, gccOk, count, ultimoHttp)
  return { criados, reservaAtual: count, gccOk }
}

/** Dispara o repositor sem bloquear a venda (fire-and-forget, nunca lanca). */
export function reporReservaDepois(supabase: any, ambiente: Ambiente): void {
  reporReservaGcc(supabase, ambiente).catch((e) => console.warn('[gcc-reserva] repor falhou:', e?.message || e))
}

/**
 * Atualiza gcc_reserva_estado e dispara os e-mails: "GCC sem gerar hash desde
 * HH:MM, reserva atual: N" (cooldown 1h) quando cai, e "voltou" quando recupera.
 * Persistente pra sobreviver a restart do container.
 */
async function registrarSaudeGcc(
  supabase: any,
  ambiente: Ambiente,
  gccOk: boolean,
  reservaAtual: number,
  ultimoHttp: number,
): Promise<void> {
  try {
    const agoraIso = new Date().toISOString()
    const { data: estado } = await supabase
      .from('gcc_reserva_estado')
      .select('gcc_ok,desde,ultimo_alerta')
      .eq('ambiente', ambiente)
      .maybeSingle()

    const eraOk = estado ? !!estado.gcc_ok : true

    if (gccOk) {
      // Recuperou: avisa uma vez (so na transicao fora->ok).
      if (!eraOk) {
        await enviarAlertaGcc(ambiente, `GCC voltou a gerar hash. Reserva atual: ${reservaAtual}.`)
      }
      await supabase.from('gcc_reserva_estado').upsert({
        ambiente, gcc_ok: true, desde: eraOk ? (estado?.desde || agoraIso) : agoraIso,
        ultimo_alerta: null, atualizado_em: agoraIso,
      })
      return
    }

    // GCC fora: marca desde (inicio da janela) e alerta com cooldown de 1h.
    const desde = eraOk ? agoraIso : (estado?.desde || agoraIso)
    const ultimoAlerta = estado?.ultimo_alerta ? new Date(estado.ultimo_alerta).getTime() : 0
    const podeAlertar = Date.now() - ultimoAlerta > MARGEM_MS // 1h
    if (podeAlertar) {
      const desdeBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(desde))
      await enviarAlertaGcc(ambiente, `GCC sem gerar hash desde ${desdeBR} (BRT). Reserva atual: ${reservaAtual}. Ultimo HTTP do GCC: ${ultimoHttp || 'sem resposta'}.`)
    }
    await supabase.from('gcc_reserva_estado').upsert({
      ambiente, gcc_ok: false, desde,
      ultimo_alerta: podeAlertar ? agoraIso : (estado?.ultimo_alerta || null),
      atualizado_em: agoraIso,
    })
  } catch (e: any) {
    console.warn('[gcc-reserva] registrar saude falhou:', e?.message || e)
  }
}

async function enviarAlertaGcc(ambiente: Ambiente, mensagem: string): Promise<void> {
  // So alerta o ambiente de PRODUCAO (o homolog oscila e nao e venda real).
  if (ambiente !== 'producao') return
  await sendErrorEmail({
    endpoint: '/premium/gcc-reserva',
    errorMessage: `RESERVA GCC: ${mensagem}`,
    paraTambem: [AVISO_GCC],
  }).catch(() => {})
}
