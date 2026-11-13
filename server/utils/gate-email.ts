// Gate de e-mail da consulta gratis (regra do Cesar, 09/nov/2026): depois da
// segunda consulta gratis, a terceira so sai com e-mail informado. Quem ja
// pagou algum relatorio fica fora da regra.
//
// IPv6 conta pelo /64 (quem tem um /64 inteiro troca de endereco a vontade), e
// requisicao sem endereco conhecido nao fica fora da contagem: todas dividem o
// balde unico 'unknown' (server/utils/client-ip.ts).
//
// "Mesmo solicitante" = mesmo IP OU mesmo device id. O device id e um UUID
// aleatorio que o proprio navegador gera e guarda no localStorage (ver
// composables/useDeviceId.ts) e manda no corpo do POST. Ele existe porque o
// bot gira IP; sozinho nao vale nada (o bot pode simplesmente nao mandar), por
// isso o IP continua contando junto.
//
// Prova de pagamento: so o token do relatorio (pedidos_premium.token_entrega)
// que o navegador ja guarda no historico local, conferido no servidor contra
// um pedido com pago_em. Token desconhecido e token nao pago dao a MESMA
// resposta (o gate), entao a rota nao vira oraculo de token.
//
// Chamadas simultaneas: quem passou no gate pela contagem e ainda nao gravou a
// linha da consulta fica reservado em memoria (server/utils/reserva-teto.ts) e
// entra na conta das requisicoes do mesmo IP ou aparelho que vem junto. Sem
// isso, N requisicoes sobrepostas liam todas "zero consultas" e passavam.
//
// Nada aqui loga e-mail nem token.

import { inicioDaContagem, emVooPara, reservar, SEM_RESERVA, type Liberar } from './reserva-teto'
import { chaveTetoIp, condicaoOrIp, normalizarIp, IP_DESCONHECIDO } from './client-ip'

export const GATE_EMAIL_LIMITE_GRATIS = 2

/**
 * Quantas consultas gratis sem e-mail cada IP/aparelho tem em 24h. Vem de
 * NUXT_CONSULTA_GRATIS_SEM_EMAIL (runtime). 2 = regra permanente; 0 = modo
 * emergencia (toda consulta sem e-mail cai no gate, menos quem pagou).
 * Valor invalido ou ausente = 2.
 */
export function limiteGratisSemEmail(v: unknown): number {
  if (v === '' || v === null || v === undefined) return GATE_EMAIL_LIMITE_GRATIS
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  return Number.isInteger(n) && n >= 0 ? n : GATE_EMAIL_LIMITE_GRATIS
}
export const GATE_EMAIL_JANELA_MS = 24 * 60 * 60 * 1000
export const GATE_EMAIL_CODE = 'email_obrigatorio'
export const GATE_EMAIL_MENSAGEM = 'Para continuar consultando grátis, informe seu e-mail.'
/** Quantos tokens do historico local o servidor aceita conferir por request. */
export const GATE_EMAIL_MAX_TOKENS = 12

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Token de entrega: alfanumerico com - e _ (o formato real varia; so barra lixo).
const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/

/** Device id aceito: UUID. Qualquer outra coisa conta como ausente. */
export function sanearDeviceId(v: unknown): string | null {
  return typeof v === 'string' && UUID_RE.test(v.trim()) ? v.trim().toLowerCase() : null
}

/** Tokens de relatorio vindos do cliente: so strings no formato, sem repetir, com teto. */
export function sanearTokensPagos(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out = new Set<string>()
  for (const t of v) {
    if (typeof t === 'string' && TOKEN_RE.test(t)) out.add(t)
    if (out.size >= GATE_EMAIL_MAX_TOKENS) break
  }
  return [...out]
}

export interface GateEmailDeps {
  /** Conta consultas do IP ou do device desde `desdeIso`. Lanca em erro de banco. */
  contarConsultas: (q: { ip: string | null; deviceId: string | null; desdeIso: string }) => Promise<number>
  /** true se algum dos tokens e de um pedido com pagamento confirmado. */
  algumTokenPago: (tokens: string[]) => Promise<boolean>
}

export interface GateEmailEntrada {
  temEmail: boolean
  ip: string | null
  deviceId: string | null
  tokensPagos: string[]
  agora?: number
  /** Consultas gratis sem e-mail permitidas em 24h (default 2; 0 = emergencia). */
  limite?: number
}

export type GateEmailMotivo = 'com_email' | 'sem_identificador' | 'abaixo_do_limite' | 'pagou' | 'erro_contagem' | 'gate'

export interface GateEmailResultado {
  exigirEmail: boolean
  motivo: GateEmailMotivo
  consultas?: number
  /**
   * So quando passou pela contagem ('abaixo_do_limite'): libera a vaga em voo.
   * Chamar no fim da requisicao (true = a linha da consulta foi gravada).
   */
  liberar?: Liberar
}

/** Chaves das reservas em voo do gate: uma por IP e uma por aparelho. */
function chavesDoGate(ip: string | null, deviceId: string | null): string[] {
  const chaves: string[] = []
  if (ip) chaves.push(`gate|ip|${chaveTetoIp(ip)}`)
  if (deviceId) chaves.push(`gate|dev|${deviceId}`)
  return chaves
}

/**
 * Decide se esta consulta precisa de e-mail. Fail-open em erro de banco: o
 * teto por IP/hora (rate limit) continua de pe como contencao; o gate e um
 * freio extra, nao pode derrubar consulta legitima por instabilidade.
 */
export async function avaliarGateEmail(deps: GateEmailDeps, e: GateEmailEntrada): Promise<GateEmailResultado> {
  if (e.temEmail) return { exigirEmail: false, motivo: 'com_email' }
  const limite = e.limite ?? GATE_EMAIL_LIMITE_GRATIS
  // Endereco validado, ou o literal do balde unico quando o chamador mandou
  // 'unknown' / um texto que nao e endereco. null so quando nao veio nada.
  const ip = e.ip ? (normalizarIp(e.ip) ?? IP_DESCONHECIDO) : null

  // Limite 0 (emergencia): nao ha o que contar, toda consulta sem e-mail cai
  // no gate, inclusive sem IP/aparelho identificavel. So o pagamento livra.
  let consultas: number | undefined
  if (limite > 0) {
    if (!ip && !e.deviceId) return { exigirEmail: false, motivo: 'sem_identificador' }
    const desdeIso = new Date((e.agora ?? Date.now()) - GATE_EMAIL_JANELA_MS).toISOString()
    const chaves = chavesDoGate(ip, e.deviceId)
    let inicio: number | null = null
    try { inicio = inicioDaContagem() } catch { inicio = null }
    try {
      consultas = await deps.contarConsultas({ ip, deviceId: e.deviceId, desdeIso })
    } catch {
      return { exigirEmail: false, motivo: 'erro_contagem' }
    }
    // Sem await daqui ate o return: decisao + reserva num passo so. O maior
    // entre as chaves (a mesma requisicao em voo segura as duas). Falha aberta.
    let emVoo = 0
    try {
      if (inicio !== null) for (const c of chaves) emVoo = Math.max(emVoo, emVooPara(c, inicio))
    } catch { emVoo = 0 }
    if (consultas + emVoo < limite) {
      let liberar: Liberar = SEM_RESERVA
      try {
        if (inicio !== null) {
          const libs = chaves.map((c) => reservar(c))
          liberar = (consumiu, quando) => { for (const l of libs) l(consumiu, quando) }
        }
      } catch { liberar = SEM_RESERVA }
      return { exigirEmail: false, motivo: 'abaixo_do_limite', consultas, liberar }
    }
  }

  if (e.tokensPagos.length) {
    try {
      if (await deps.algumTokenPago(e.tokensPagos)) return { exigirEmail: false, motivo: 'pagou', consultas }
    } catch { /* lookup falhou: segue como nao comprovado */ }
  }
  return { exigirEmail: true, motivo: 'gate', consultas }
}

/** Dependencias reais: `consultas` no Supabase do site, `pedidos_premium` no premium. */
export function depsGateEmailSupabase(supabase: any, premium: () => any): GateEmailDeps {
  return {
    async contarConsultas({ ip, deviceId, desdeIso }) {
      const contar = async (ors: string[]) => {
        const { count, error } = await supabase
          .from('consultas')
          .select('id', { count: 'exact', head: true })
          .or(ors.join(','))
          .gte('created_at', desdeIso)
        if (error) throw error
        return count ?? 0
      }
      const ors: string[] = []
      // condicaoOrIp: o endereco exato no IPv4, o /64 no IPv6, 'unknown' no
      // balde unico. O texto do IP nunca entra cru no filtro.
      if (ip) ors.push(condicaoOrIp('ip_address', ip))
      if (deviceId) ors.push(`device_id.eq.${deviceId}`)
      try {
        return await contar(ors)
      } catch (err) {
        // Coluna device_id ainda nao existe (deploy antes da migration): cai
        // pro IP sozinho em vez de abrir o gate.
        if (ip && deviceId) return await contar([condicaoOrIp('ip_address', ip)])
        throw err
      }
    },
    async algumTokenPago(tokens) {
      const { data, error } = await premium()
        .from('pedidos_premium')
        .select('id')
        .in('token_entrega', tokens)
        .not('pago_em', 'is', null)
        .limit(1)
      if (error) throw error
      return Array.isArray(data) && data.length > 0
    },
  }
}
