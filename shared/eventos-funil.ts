// Funil do meio do caminho, medido no NOSSO servidor.
//
// Ate aqui so existia gtag: dado de terceiro, amostrado, sem quebra por placa
// ou por sinal de leilao, e invisivel quando o bloqueador de anuncio entra em
// cena. A queda de consulta gratis -> checkout (de ~3% pra ~1%) nao tinha como
// ser investigada porque nenhuma etapa entre "vi o resultado" e "abri o
// checkout" era gravada em algum lugar nosso.
//
// A allowlist e o contrato: nome fora dela nao entra no banco. Assim um
// payload adulterado (ou um evento novo esquecido no client) nunca vira linha
// nova, e a tabela continua legivel meses depois.

export const EVENTOS_FUNIL = [
  /** Consulta gratis renderizou com dados na tela. */
  'resultado_exibido',
  /** A frase de sinal de leilao apareceu (positivo ou negativo). */
  'leilao_sinal_visto',
  /** A frase de sinal de recall apareceu (so quando consta: firme ou suave). */
  'recall_sinal_visto',
  /** O bloco bloqueado / botao da Completa entrou na tela. */
  'cta_completa_visto',
  /** Clique no CTA da Completa. */
  'cta_completa_click',
  /** Overlay do checkout abriu. */
  'premium_checkout_open',
  /** Tela de confirmacao do checkout apareceu. */
  'checkout_confirm_visto',
  /** Cobranca Pix criada de verdade. */
  'pix_gerado',
  /** Fechou o checkout antes de existir cobranca. */
  'checkout_fechado_sem_pagar',
  /** Informou e-mail no checkout ou na tela do Pix. */
  'email_informado',
  /** Relatorio pago: marcou ou desmarcou um item do checklist (extra: item_id, marcado; sem PII). */
  'checklist_marcado',
] as const

export type EventoFunil = (typeof EVENTOS_FUNIL)[number]

const ALLOWLIST = new Set<string>(EVENTOS_FUNIL)

export function eventoPermitido(nome: unknown): nome is EventoFunil {
  return typeof nome === 'string' && ALLOWLIST.has(nome)
}

/** Teto de eventos por requisicao: lote do client, nao despejo. */
export const MAX_EVENTOS_POR_LOTE = 10

export const SINAIS_LEILAO = ['positivo', 'negativo', 'sem_sinal'] as const

/**
 * Hook de recall na consulta gratis: firme/suave = a frase apareceu;
 * negativo = a base respondeu "nao consta"; fora_escopo = marca sem base (nem
 * chama); sem_sinal = erro/timeout/teto ou ainda nao respondeu.
 */
export const SINAIS_RECALL = ['firme', 'suave', 'negativo', 'fora_escopo', 'sem_sinal'] as const
export type SinalRecallMedido = (typeof SINAIS_RECALL)[number]

/** recall_sinal vindo do client -> valor da allowlist (senao null: evento antigo/sem o campo). */
export function sanearSinalRecall(v: unknown): SinalRecallMedido | null {
  return typeof v === 'string' && (SINAIS_RECALL as readonly string[]).includes(v) ? (v as SinalRecallMedido) : null
}

/** recall_marca: so letras/espaco/hifen, maiusculas, ate 30. */
export function sanearMarcaRecall(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.toUpperCase().replace(/[^A-ZÀ-Ý \-]/g, '').trim().slice(0, 30)
  return t || null
}

export interface EventoFunilSaneado {
  evento: EventoFunil
  placa: string | null
  sessao: string | null
  origem: Record<string, string | null> | null
  leilao_sinal: string
  recall_sinal: SinalRecallMedido | null
  recall_marca: string | null
  plano: string | null
  extra: Record<string, string | number | boolean> | null
}

/** Campos que NUNCA podem atravessar, mesmo que o client mande. */
const PROIBIDOS = new Set(['email', 'e_mail', 'telefone', 'phone', 'ip', 'user_agent', 'ua', 'token', 'chassi', 'cpf', 'nome'])

function texto(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

/**
 * Normaliza UM evento do lote. Devolve null quando o nome nao esta na
 * allowlist: melhor descartar em silencio do que gravar lixo, porque este
 * endpoint e publico e nao autenticado.
 *
 * `extra` aceita so escalares, no maximo 8 chaves, e nenhuma chave da lista de
 * proibidos: e o unico campo livre, entao e por ele que PII entraria.
 */
export function sanearEvento(bruto: unknown): EventoFunilSaneado | null {
  const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  if (!eventoPermitido(o.evento)) return null

  const placaCrua = typeof o.placa === 'string' ? o.placa.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7) : ''
  const sinal = typeof o.leilao_sinal === 'string' && (SINAIS_LEILAO as readonly string[]).includes(o.leilao_sinal)
    ? o.leilao_sinal
    : 'sem_sinal'

  let origem: Record<string, string | null> | null = null
  if (o.origem && typeof o.origem === 'object') {
    const bruta = o.origem as Record<string, unknown>
    const saida: Record<string, string | null> = {}
    for (const campo of ['gclid', 'msclkid', 'utm_source', 'utm_medium', 'utm_campaign']) {
      saida[campo] = texto(bruta[campo], 200)
    }
    origem = saida
  }

  let extra: Record<string, string | number | boolean> | null = null
  if (o.extra && typeof o.extra === 'object') {
    const saida: Record<string, string | number | boolean> = {}
    let n = 0
    for (const [k, v] of Object.entries(o.extra as Record<string, unknown>)) {
      if (n >= 8) break
      const chave = k.toLowerCase()
      if (PROIBIDOS.has(chave)) continue
      if (typeof v === 'string') saida[chave] = v.slice(0, 80)
      else if (typeof v === 'number' && Number.isFinite(v)) saida[chave] = v
      else if (typeof v === 'boolean') saida[chave] = v
      else continue
      n++
    }
    extra = Object.keys(saida).length ? saida : null
  }

  return {
    evento: o.evento,
    placa: placaCrua.length === 7 ? placaCrua : null,
    sessao: texto(o.sessao, 40),
    origem,
    leilao_sinal: sinal,
    recall_sinal: sanearSinalRecall(o.recall_sinal),
    recall_marca: sanearMarcaRecall(o.recall_marca),
    plano: typeof o.plano === 'string' && ['basica', 'completa'].includes(o.plano) ? o.plano : null,
    extra,
  }
}

/** Sanea o lote inteiro, respeitando o teto e descartando o que nao passa. */
export function sanearLote(bruto: unknown): EventoFunilSaneado[] {
  const lista = Array.isArray(bruto) ? bruto : Array.isArray((bruto as any)?.eventos) ? (bruto as any).eventos : []
  const saida: EventoFunilSaneado[] = []
  for (const item of lista.slice(0, MAX_EVENTOS_POR_LOTE)) {
    const ok = sanearEvento(item)
    if (ok) saida.push(ok)
  }
  return saida
}
