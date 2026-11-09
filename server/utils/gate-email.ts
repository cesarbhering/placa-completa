// Gate de e-mail da consulta gratis (regra do Cesar, 09/nov/2026): depois da
// segunda consulta gratis, a terceira so sai com e-mail informado. Quem ja
// pagou algum relatorio fica fora da regra.
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
// Nada aqui loga e-mail nem token.

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
}

/**
 * Decide se esta consulta precisa de e-mail. Fail-open em erro de banco: o
 * teto por IP/hora (rate limit) continua de pe como contencao; o gate e um
 * freio extra, nao pode derrubar consulta legitima por instabilidade.
 */
export async function avaliarGateEmail(deps: GateEmailDeps, e: GateEmailEntrada): Promise<GateEmailResultado> {
  if (e.temEmail) return { exigirEmail: false, motivo: 'com_email' }
  const limite = e.limite ?? GATE_EMAIL_LIMITE_GRATIS
  const ip = e.ip && e.ip !== 'unknown' ? e.ip : null

  // Limite 0 (emergencia): nao ha o que contar, toda consulta sem e-mail cai
  // no gate, inclusive sem IP/aparelho identificavel. So o pagamento livra.
  let consultas: number | undefined
  if (limite > 0) {
    if (!ip && !e.deviceId) return { exigirEmail: false, motivo: 'sem_identificador' }
    const desdeIso = new Date((e.agora ?? Date.now()) - GATE_EMAIL_JANELA_MS).toISOString()
    try {
      consultas = await deps.contarConsultas({ ip, deviceId: e.deviceId, desdeIso })
    } catch {
      return { exigirEmail: false, motivo: 'erro_contagem' }
    }
    if (consultas < limite) return { exigirEmail: false, motivo: 'abaixo_do_limite', consultas }
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
      if (ip) ors.push(`ip_address.eq.${ip}`)
      if (deviceId) ors.push(`device_id.eq.${deviceId}`)
      try {
        return await contar(ors)
      } catch (err) {
        // Coluna device_id ainda nao existe (deploy antes da migration): cai
        // pro IP sozinho em vez de abrir o gate.
        if (ip && deviceId) return await contar([`ip_address.eq.${ip}`])
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
