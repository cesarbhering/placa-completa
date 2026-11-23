// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import REAL from './__fixtures__/parceiro-leilao-real.json'
import COM from './__fixtures__/parceiro-historico-com-registros.json'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// Engine number lookup of the plate: not part of this test.
vi.mock('./placa-lookup', () => ({ consultarPlacaWdapi: async () => null, motorDoPayload: () => null }))

import { montarRelatorioSnapshot } from './relatorio-snapshot'
import { iniciarHistoricoVeicular, _limparEmVooHistorico } from './parceiro-historico'
import { cfgHistorico } from './parceiro-historico-env'
import { _limparTokenParceiro, _limparAlertaTeto, type Http } from './parceiro-leilao'
import { parsearRespostaHistorico } from '../../shared/historico-veicular'

// Snapshot assembly at the delivery (review 1 of PR #758): the vehicle history
// call started with the paid query is already back. A partial answer makes the
// auction partner its fallback right there, once; a complete one with an
// auction record of its own never calls it (one without calls it since
// 23/11/2026: parceiro-leilao-cadeia.test.ts).
const AGORA = Date.parse('2026-11-17T21:00:00Z')
const PLACA = 'TST2B34'
const CHASSI = '9XXHV00000X000001'
const CONFIG = { parceiroLeilaoLigado: 'on', parceiroLeilaoUser: 'u', parceiroLeilaoPass: 'p', parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'k', public: {} }
const vazio = () => ({ resumo: { tem_indicio: false, nivel_max: null, n_confirmado: 0, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [], indice_atualizado_em: null, aviso: null })
const resp = (status: number, corpo: any) => ({ status, text: async () => JSON.stringify(corpo) })

let sb: ReturnType<typeof supabaseMemoria>
let leilaoChamadas: string[]
const pagasLeilao = () => leilaoChamadas.filter((u) => !u.endsWith('/api/Auth/login')).length

/** The vehicle history call of the order, started with the paid query and already finished. */
async function historicoJaVeio(corpo: any, id = 'p1') {
  const http: Http = async () => resp(200, corpo) as any
  await iniciarHistoricoVeicular(sb, { id, placa: PLACA, plano: 'completa' }, { cfg: cfgHistorico(CONFIG), http, agora: AGORA, log: () => {}, esperar: async () => {} })
}
const montar = (id = 'p1') => montarRelatorioSnapshot(sb, { placa: PLACA, plano: 'completa', consulta_id: 'c1', id })

beforeEach(() => {
  sb = supabaseMemoria()
  sb.tab('senatran_consultas').push({ id: 'c1', placa: PLACA, created_at: '2026-11-17T20:59:00Z', response: { chassi: CHASSI, descricaoMarcaModelo: 'MARCA/MODELO', anoModelo: 2020, anoFabricacao: 2019, ufJurisdicao: 'SP', renavam: '1' } })
  leilaoChamadas = []
  _limparEmVooHistorico()
  _limparTokenParceiro()
  _limparAlertaTeto()
  // Nuxt auto-imports used by the assembly; only our auction base matters here (empty).
  vi.stubGlobal('useRuntimeConfig', () => CONFIG)
  vi.stubGlobal('getValorCusto', async () => null)
  vi.stubGlobal('detectarSegmento', () => 'carro')
  vi.stubGlobal('decodificarChassi', async () => null)
  vi.stubGlobal('corrigirAnoChassi', (x: any) => x)
  vi.stubGlobal('consultarHistoricoLeilao', async () => vazio())
  vi.stubGlobal('sendErrorEmail', async () => {})
  // The auction partner client calls the global fetch when nothing is injected.
  vi.stubGlobal('fetch', async (url: string) => {
    leilaoChamadas.push(url)
    return resp(200, url.endsWith('/api/Auth/login') ? { token: 'jwt' } : REAL)
  })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('snapshot assembly with the vehicle history already back', () => {
  it('partial answer: the auction partner is called once, and the next assembly reuses it', async () => {
    const parcial: any = structuredClone(COM)
    parcial.dados.raw_sources.infosinistrosSuccess = false
    await historicoJaVeio(parcial)
    const snap: any = await montar()
    expect(snap.historicoVeicular).toMatchObject({ status: 'ok', completa: false, faltas: ['sinistros'] })
    expect(snap.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true })
    expect(pagasLeilao()).toBe(1)
    expect(sb.tab('parceiro_leilao_chamadas').filter((l) => l.cobrada)).toHaveLength(1)
    // Another generation of the same order: the paid answer is reused, no new charge.
    const outra: any = await montar()
    expect(outra.historicoLeilao.parceiro.status).toBe('ok')
    expect(pagasLeilao()).toBe(1)
  })

  it('complete answer with an auction record of its own: the auction partner is never called', async () => {
    await historicoJaVeio(structuredClone(COM))
    const snap: any = await montar()
    expect(snap.historicoVeicular).toMatchObject({ status: 'ok', completa: true })
    expect(snap.historicoVeicular.leilao.registros.length).toBeGreaterThan(0)
    expect(snap.historicoLeilao.parceiro).toBeUndefined()
    expect(leilaoChamadas).toHaveLength(0)
    expect(sb.tab('parceiro_leilao_chamadas')).toHaveLength(0)
  })

  it('vehicle history not back yet (no queue job yet): not called at the assembly', async () => {
    const snap: any = await montar()
    expect(snap.historicoVeicular).toBeUndefined()
    expect(snap.historicoLeilao.parceiro).toBeUndefined()
    expect(leilaoChamadas).toHaveLength(0)
  })
})

// Review 3 of PR #758: the admin rebuild assembles only the auction section and
// asks it to keep an operator fallback's no-notice mark on a new call.
describe('refill of the auction section that keeps the no-notice mark', () => {
  it('semAvisoLeilao: the state of the new call carries parceiro.semAviso', async () => {
    const parcial: any = structuredClone(COM)
    parcial.dados.raw_sources.infosinistrosSuccess = false
    // The stored block decides (refill of one field): partial, so the fallback runs.
    sb.tab('pedidos_premium').push({ id: 'p1', relatorio_snapshot: { historicoVeicular: { ...parsearRespostaHistorico(parcial)!, consultadoEm: '2026-11-17T20:00:00Z' } } })
    const com: any = await montarRelatorioSnapshot(sb, { placa: PLACA, plano: 'completa', consulta_id: 'c1', id: 'p1' }, ['historicoLeilao'], { renovarLeilao: true, semAvisoLeilao: true })
    expect(com.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, semAviso: true })
    expect(pagasLeilao()).toBe(1)
    // Without the option (lazy fill, regular rebuild): no mark.
    const sem: any = await montarRelatorioSnapshot(sb, { placa: PLACA, plano: 'completa', consulta_id: 'c1', id: 'p1' }, ['historicoLeilao'])
    expect(sem.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true })
    expect(sem.historicoLeilao.parceiro.semAviso).toBeUndefined()
  })
})
