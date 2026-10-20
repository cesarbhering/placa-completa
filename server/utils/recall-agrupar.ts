import { createHash } from 'node:crypto'
import { HAIKU_MODEL } from './fipe-candidato'
import { lerFonteCache, gravarFonteCache } from './fonte-cache'
import { validarGrupos, type AgrupamentoRecall, type GrupoRecall } from '../../shared/recall-agrupamento'
import type { CampanhaBase } from '../../shared/recall-associado'

// Agente que agrupa campanhas de recall parecidas (shared/recall-agrupamento.ts).
// Mesmo setup do juiz da FIPE e do revisor do DETRAN: claude-haiku-5-5, chave
// NUXT_ANTHROPIC_API_KEY, sem temperature (da 400), thinking desligado,
// structured output. Roda UMA vez, quando o recallBase do pedido e montado;
// o resultado fica no snapshot. Cache por hash do conjunto em fonte_cache
// ('agrupamento_recall', 365 d): o mesmo modelo/ano repete as mesmas campanhas.
// Timeout de 5 s; qualquer falha devolve null e a tela mostra a lista original.
// Custo em premium_custos (fonte 'anthropic_recall'), so quando chamou a API.

export const FONTE_AGRUPAMENTO = 'agrupamento_recall'
export const FONTE_CUSTO = 'anthropic_recall'
export const TIMEOUT_MS = 5000
// Preco do Haiku por milhao de tokens (USD) e cambio, so pra estimar o custo
// gravado. Ajustavel por env sem deploy de codigo.
const USD_MTOK_ENTRADA = Number(process.env.HAIKU_USD_MTOK_ENTRADA || 1)
const USD_MTOK_SAIDA = Number(process.env.HAIKU_USD_MTOK_SAIDA || 5)
const BRL_POR_USD = Number(process.env.BRL_POR_USD || 5.5)

const SCHEMA = {
  type: 'object',
  properties: {
    grupos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          resumo: { type: 'string' },
          indices: { type: 'array', items: { type: 'integer' } },
          anos: { type: 'string' },
          modelo: { type: 'string' },
        },
        required: ['titulo', 'resumo', 'indices', 'anos', 'modelo'],
        additionalProperties: false,
      },
    },
  },
  required: ['grupos'],
  additionalProperties: false,
}

/** Linha de cada campanha no prompt e no hash (so o que identifica a campanha). */
function linhaCampanha(c: CampanhaBase): string {
  return [c.codigo || '', c.nome || '', c.modelo || '', c.ano_modelo ?? '', c.fabricacaoDe || '', c.fabricacaoAte || '', c.risco || '']
    .map((v) => String(v).replace(/\s+/g, ' ').trim()).join(' | ')
}

export function hashCampanhas(camps: CampanhaBase[]): string {
  return createHash('sha256').update(camps.map(linhaCampanha).join('\n')).digest('hex').slice(0, 40)
}

export function promptAgrupar(camps: CampanhaBase[]): string {
  return [
    'Você organiza campanhas de recall de um veículo para um relatório lido por leigos.',
    'Abaixo, cada linha é uma campanha: índice. código | nome | modelo | anos do modelo | fabricação de | até | risco.',
    ...camps.map((c, i) => `${i}. ${linhaCampanha(c)}`),
    '',
    'Agrupe as campanhas que tratam do MESMO componente e defeito (ex.: "gerador de gás do airbag do motorista" e "do motorista e/ou do passageiro" são o mesmo assunto: airbag).',
    'Campanhas de componentes diferentes ficam em grupos diferentes.',
    'Regra obrigatória: cada índice aparece em exatamente um grupo. Não omita nem repita índices.',
    'Para cada grupo: "titulo" curto (até 60 caracteres), "resumo" de uma frase simples sobre o que o defeito pode causar (sem afirmar que o carro tem o problema), "anos" com a faixa somada (ex.: "2009 a 2016", vazio se não houver), "modelo" (ex.: "Voyage").',
    'Não use travessão. Escreva em português.',
  ].join('\n')
}

async function perguntarHaiku(camps: CampanhaBase[], chaveApi: string, fetcher: typeof fetch): Promise<{ grupos: GrupoRecall[]; tokensIn: number; tokensOut: number } | { erro: string; tokensIn: number; tokensOut: number }> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': chaveApi, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 1200,
        thinking: { type: 'disabled' },
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [{ role: 'user', content: promptAgrupar(camps) }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) return { erro: `HTTP ${res.status}`, tokensIn: 0, tokensOut: 0 }
    const body: any = await res.json()
    const tokensIn = Number(body?.usage?.input_tokens) || 0
    const tokensOut = Number(body?.usage?.output_tokens) || 0
    const bloco = (Array.isArray(body?.content) ? body.content : []).find((b: any) => b?.type === 'text')
    let parsed: any
    try { parsed = JSON.parse(String(bloco?.text || '')) } catch { return { erro: 'JSON invalido', tokensIn, tokensOut } }
    const grupos = validarGrupos(parsed?.grupos, camps.length)
    if (!grupos) return { erro: 'indices invalidos', tokensIn, tokensOut }
    return { grupos, tokensIn, tokensOut }
  } catch (e: any) {
    return { erro: e?.name === 'AbortError' ? `timeout ${TIMEOUT_MS} ms` : String(e?.message || e).slice(0, 120), tokensIn: 0, tokensOut: 0 }
  } finally {
    clearTimeout(t)
  }
}

export function custoBrl(tokensIn: number, tokensOut: number): number {
  return Math.round(((tokensIn * USD_MTOK_ENTRADA + tokensOut * USD_MTOK_SAIDA) / 1e6) * BRL_POR_USD * 1e5) / 1e5
}

/**
 * Agrupamento pra uma lista de campanhas (2 ou mais), ou null (lista original).
 * Nunca lanca.
 */
export async function agruparCampanhasRecall(
  camps: CampanhaBase[],
  op: { sb?: { from: (t: string) => any } | null; chaveApi?: string | null; fetcher?: typeof fetch; pedidoId?: string | null; log?: (m: string) => void } = {},
): Promise<AgrupamentoRecall | null> {
  const log = op.log ?? ((m: string) => console.warn(m))
  try {
    const lista = (camps || []).filter((c) => c && (c.nome || c.codigo))
    if (lista.length !== (camps || []).length || lista.length < 2) return null
    const hash = hashCampanhas(lista)
    if (op.sb) {
      const hit = await lerFonteCache<AgrupamentoRecall>(op.sb, FONTE_AGRUPAMENTO, hash)
      const grupos = hit?.payload ? validarGrupos(hit.payload.grupos, lista.length) : null
      if (grupos) return { hash, total: lista.length, grupos }
    }
    if (!op.chaveApi) return null
    const r = await perguntarHaiku(lista, op.chaveApi, op.fetcher || fetch)
    if (op.sb && (r.tokensIn || r.tokensOut)) {
      try {
        await op.sb.from('premium_custos').insert({
          pedido_id: op.pedidoId ?? null, fonte: FONTE_CUSTO, preco: custoBrl(r.tokensIn, r.tokensOut),
          code: 'grupos' in r ? 200 : 422,
          detalhe: `tokens ${r.tokensIn}/${r.tokensOut}${'erro' in r ? `; ${r.erro}` : ''}`,
        })
      } catch { /* custo e diagnostico: nunca derruba */ }
    }
    if ('erro' in r) { log(`[recall-agrupar] sem agrupamento (lista original): ${r.erro}`); return null }
    const out: AgrupamentoRecall = { hash, total: lista.length, grupos: r.grupos }
    if (op.sb) await gravarFonteCache(op.sb, FONTE_AGRUPAMENTO, hash, out, 'ok')
    return out
  } catch (e: any) {
    log(`[recall-agrupar] falhou (lista original): ${String(e?.message || e).slice(0, 120)}`)
    return null
  }
}
