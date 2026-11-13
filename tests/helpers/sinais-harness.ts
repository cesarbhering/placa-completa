// Test harness for the two signal routes of the free lookup
// (server/api/leilao-sinal.post.ts and server/api/recall-sinal.post.ts).
//
// Auto-imports are stubbed, the two calls to the auction/recall base are
// replaced by recorders, and the rest (cap per IP, plate block, cache, the
// server-side profile read from placa_cache) is the real code on top of an
// in-memory database. Plates, addresses and vehicles here are fictitious.
import { vi } from 'vitest'
import { supabaseMemoria } from './supabase-memoria'

export const UA_NAVEGADOR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

export interface OpcoesSinais {
  /** What the auction base answers for a profile. Default: one confirmed record. null = base down. */
  historico?: (perfil: any) => any
  /** What the recall base answers for a profile. Default: one match by model. null = base down. */
  recall?: (perfil: any) => any
}

export const HISTORICO_POSITIVO = { resumo: { n_confirmado: 1, n_provavel: 0, n_possivel: 0 }, passagens: [] }
export const HISTORICO_VAZIO = { resumo: { n_confirmado: 0, n_provavel: 0, n_possivel: 0 }, passagens: [] }
export const RECALL_POSITIVO = { matches: [{ recall_id: 1, code: null, name: null, model: null, model_year: null, start_date: null, nivel: 'suave', situacao: 'consta_em_campanha', pdf_r2: null }] }
export const RECALL_VAZIO = { matches: [] }

export async function montarSinais(opts: OpcoesSinais = {}) {
  vi.resetModules()
  const agora = () => ({ created_at: new Date().toISOString() })
  const sb = supabaseMemoria({ padroes: { blocked_requests: agora } })
  const estado = {
    /** Profiles sent to the auction base, in order. */
    leilao: [] as any[],
    /** Profiles sent to the recall base, in order. */
    recall: [] as any[],
  }

  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { homolog: false, gated: false } }))
  vi.stubGlobal('readBody', async (event: any) => event.corpo)
  vi.stubGlobal('getRequestHeaders', (event: any) => event.cabecalhos || {})
  vi.stubGlobal('getRequestHeader', (event: any, nome: string) => (event.cabecalhos || {})[nome])
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.stubGlobal('useSupabaseServer', () => sb)
  vi.stubGlobal('consultarHistoricoLeilao', async (perfil: any) => {
    estado.leilao.push(perfil)
    return opts.historico ? opts.historico(perfil) : HISTORICO_POSITIVO
  })
  vi.doMock('~/server/utils/supabase', () => ({ useSupabaseServer: () => sb }))
  vi.doMock('~/server/utils/recall-toyota', () => ({
    consultarRecallToyota: async (perfil: any) => {
      estado.recall.push(perfil)
      return opts.recall ? opts.recall(perfil) : RECALL_POSITIVO
    },
  }))

  const leilaoHandler = (await import('~/server/api/leilao-sinal.post')).default as (event: any) => Promise<any>
  const recallHandler = (await import('~/server/api/recall-sinal.post')).default as (event: any) => Promise<any>

  const evento = (corpo: any, o: { ip?: string | null; cabecalhos?: Record<string, string> } = {}) => {
    const ip = o.ip === undefined ? '203.0.113.10' : o.ip
    const cabecalhos: Record<string, string> = { 'user-agent': UA_NAVEGADOR, ...(o.cabecalhos || {}) }
    if (ip) cabecalhos['cf-connecting-ip'] = ip
    return { corpo, cabecalhos, node: { req: { headers: cabecalhos } } }
  }

  return {
    sb,
    estado,
    leilao: (corpo: any, o?: Parameters<typeof evento>[1]) => leilaoHandler(evento(corpo, o)),
    recall: (corpo: any, o?: Parameters<typeof evento>[1]) => recallHandler(evento(corpo, o)),
    /** Stores what the free lookup would have left in placa_cache for a plate. */
    guardarPlaca(placa: string, payload: Record<string, any>) {
      sb.tab('placa_cache').push({ placa, payload, encontrado: true, fetched_at: new Date().toISOString() })
    },
  }
}
