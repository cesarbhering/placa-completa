// Test helpers for the calls made with the owner's CPF or CNPJ (SEFAZ-MG IPVA,
// DETRAN-RJ fines): fictitious owner data marked so that any leak is easy to
// spot, the vehicle history partner answer as stored in the restricted table,
// and an in-memory database with the RPCs these flows use. Not a test file.
import { vi, expect } from 'vitest'
import { supabaseMemoria } from './supabase-memoria'
import { cfgHistorico } from '../../server/utils/parceiro-historico-env'
import { quantasEmVoo } from '../../server/utils/tarefas-em-voo'

// Fictitious, not real people.
export const CPF = '123.456.789-09' // ggignore
export const CPF_DIGITOS = '12345678909' // ggignore
export const CNPJ = '11.222.333/0001-81' // ggignore
export const CNPJ_DIGITOS = '11222333000181' // ggignore
export const NOME = 'DONO FICTICIO MARCADO'
export const CHASSI = '9XXHV00000X000001' // ggignore
export const RENAVAM = '00987654321'
export const PLACA = 'TST2B34'
export const H = 60 * 60 * 1000

/** None of these may ever leave the restricted table. */
export const MARCADOS = [CPF, CPF_DIGITOS, CNPJ, CNPJ_DIGITOS, NOME, '456.789-09', '333/0001'] // ggignore
export const vazamentos = (s: string) => MARCADOS.filter((x) => s.includes(x))

export const RUNTIME = { infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }

/** The paid registry answer of the vehicle, as the snapshot keeps it. */
export const respostaSenatran = (uf: string) => ({ ufJurisdicao: uf, renavam: '987654321', chassi: CHASSI, placa: PLACA }) // ggignore

/** Vehicle history partner answer as stored in the restricted table (only there it has name and document). */
export function respostaParceira(doc: string | null = CPF, dados: any = {}, fontes: any = {}) {
  return {
    success: true, queryId: 'q-teste', custo_debitado: 1.9,
    dados: {
      placa: PLACA, chassi: CHASSI,
      proprietarios: {
        total: 1,
        proprietario_atual: { ordem: 1, nome: NOME, documento: '***.456.789-**', documentoOriginal: doc, tipo: 'Pessoa fisica', uf: 'MG', atual: true },
        historico: [{ ordem: 1, nome: NOME, documento: '***.456.789-**', tipo: 'Pessoa fisica', data: '2020-01-02', uf: 'MG', atual: true }],
      },
      raw_sources: { e2Success: true, e5Success: true, infosinistrosSuccess: true, ...fontes },
      ...dados,
    },
  }
}

/** In-memory database with the RPCs these flows use (named lock with lease, partner reservation and snapshot key). */
export function banco() {
  let seq = 0
  const sb: any = supabaseMemoria({
    rpc: (nome: string, a: any) => {
      if (nome === 'job_lock_pegar') {
        const t = sb.tab('job_lock')
        const agora = Date.now()
        const ate = new Date(agora + a.p_segundos * 1000).toISOString()
        const l = t.find((x: any) => x.nome === a.p_nome)
        if (!l) { t.push({ nome: a.p_nome, dono: a.p_dono, ate }); return true }
        if (Date.parse(l.ate) < agora || l.dono === a.p_dono) { Object.assign(l, { dono: a.p_dono, ate }); return true }
        return false
      }
      if (nome === 'parceiro_historico_reservar') {
        const id = `reserva-${++seq}`
        sb.tab('parceiro_historico_chamadas').push({ id, pedido_id: a.p_pedido, placa: a.p_placa, em_andamento: true, cobrada: false, cache_hit: false, criado_em: new Date().toISOString() })
        return id
      }
      if (nome === 'snapshot_gravar_historico_veicular') {
        const p = sb.tab('pedidos_premium').find((x: any) => x.id === a.p_pedido)
        if (!p?.relatorio_snapshot) return false
        p.relatorio_snapshot = { ...p.relatorio_snapshot, historicoVeicular: a.p_valor }
        return true
      }
      return true
    },
  })
  return sb
}

/** A paid order (Completa by default) of a vehicle registered in `uf`. */
export function comPedido(sb: any, x: { id?: string; uf?: string; plano?: string; multas?: any; snap?: any } = {}) {
  const snap: any = { consulta: { response: respostaSenatran(x.uf ?? 'MG') }, ...(x.snap || {}) }
  if (x.multas) snap.multas = structuredClone(x.multas)
  sb.tab('pedidos_premium').push({ id: x.id ?? 'p1', placa: PLACA, plano: x.plano ?? 'completa', relatorio_snapshot: snap })
}

/** The paid partner answer of an order, in the restricted table. */
export function comRespostaPaga(sb: any, pedidoId: string | null, bruto: any, criadoEm = new Date().toISOString()) {
  sb.tab('parceiro_historico_chamadas').push({ id: `pago-${pedidoId}`, pedido_id: pedidoId, placa: PLACA, cobrada: true, cache_hit: false, sucesso: true, resposta_bruta: structuredClone(bruto), criado_em: criadoEm })
}

export const snapDe = (sb: any, id = 'p1') => sb.tab('pedidos_premium').find((p: any) => p.id === id)?.relatorio_snapshot
export const pedidoCompleta = (id = 'p1') => ({ id, placa: PLACA, plano: 'completa' })
export const esperarVoo = () => vi.waitFor(() => expect(quantasEmVoo()).toBe(0), { timeout: 3000 })

/** Partner client that answers `corpo` (the queue job and the step after the delivery use the same function). */
export const depsParceira = (corpo: any) => ({
  cfg: cfgHistorico({ parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'chave-de-teste' }),
  http: async () => ({ status: 200, text: async () => JSON.stringify(corpo) }),
  alertar: async () => {}, log: () => {}, esperar: async () => {}, reservaLeilao: async () => {},
})

/** fetch answered by the end of the URL; returns the request bodies sent to each route. */
export function stubFetchPorRota(rotas: Record<string, any>): Record<string, URLSearchParams[]> {
  const corpos: Record<string, URLSearchParams[]> = Object.fromEntries(Object.keys(rotas).map((r) => [r, []]))
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const rota = Object.keys(rotas).find((r) => url.endsWith(r))
    if (!rota) throw new Error(`url inesperada ${url}`)
    corpos[rota]!.push(init.body)
    const r = typeof rotas[rota] === 'function' ? await rotas[rota]() : rotas[rota]
    return { status: 200, json: async () => r }
  }))
  return corpos
}

/** Every console line, for the checks that nothing personal is logged. */
export function capturarLogs(): string[] {
  const logs: string[] = []
  for (const k of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, k).mockImplementation((...a: any[]) => { logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')) })
  }
  return logs
}
