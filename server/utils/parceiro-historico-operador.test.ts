// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import REAL from './__fixtures__/parceiro-leilao-real.json'
import SEM from './__fixtures__/parceiro-historico-sem-registros.json'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'
import { pedidosComCaminhos } from '../../tests/helpers/supabase-caminhos'

// Customer e-mails of the late auction notice, captured (the real notifier runs).
const { enviados } = vi.hoisted(() => ({ enviados: [] as any[] }))
vi.mock('./premium-email', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  enviarAvisoLeilao: vi.fn(async (m: any) => { enviados.push(m); return true }),
}))
// Engine number lookup of the plate (snapshot assembly of the rebuild): not part of these tests.
vi.mock('./placa-lookup', () => ({ consultarPlacaWdapi: async () => null, motorDoPayload: () => null }))

import { completarHistoricoVeicular, completarHistoricoVeicularOperador } from './parceiro-historico'
import { cfgHistorico } from './parceiro-historico-env'
import { _limparTokenParceiro, _limparAlertaTeto, rodarJobParceiro, cfgParceiro } from './parceiro-leilao'
import { rebuildLeilao } from './rebuild-leilao'
import { parsearRespostaHistorico } from '../../shared/historico-veicular'

// Review 1 of PR #758, item 2: the operator route
// (server/api/premium/historico-veicular/rodar.post.ts) runs the auction
// partner fallback for an order whose vehicle history failed, but never
// e-mails the customer: a notice from a manual run only goes out with a text
// Cesar approved.
const CONFIG = { parceiroLeilaoLigado: 'on', parceiroLeilaoUser: 'u', parceiroLeilaoPass: 'p', parceiroHistoricoLigado: 'on', parceiroHistoricoKey: 'k', public: {} }
const PEDIDO = { id: 'p1', placa: 'TST2B34', plano: 'completa' }
const vazio = () => ({ resumo: { tem_indicio: false, nivel_max: null, n_confirmado: 0, n_provavel: 0, n_possivel: 0, possiveis_ambiguos: 0, fontes_com_passagem: [] }, passagens: [], indice_atualizado_em: null, aviso: null })

let chamadas: string[]
/** The auction partner answers 503 while this is on. */
let foraDoAr = false
const pagas = () => chamadas.filter((u) => !u.endsWith('/api/Auth/login')).length

/** An order whose stored vehicle history is partial and shows no auction: what the auction partner finds is news. */
function pedidoComParcial() {
  const r: any = structuredClone(SEM)
  r.dados.raw_sources.e5Success = false
  const sb = supabaseMemoria()
  // The paid query of the order (the rebuild assembles the auction section again from it).
  sb.tab('senatran_consultas').push({ id: 'c1', placa: PEDIDO.placa, created_at: '2026-11-17T19:00:00Z', response: { chassi: r.dados.chassi, descricaoMarcaModelo: 'MARCA/MODELO', anoModelo: 2020, ufJurisdicao: 'SP' } })
  sb.tab('pedidos_premium').push({
    ...PEDIDO, status: 'entregue', email: 'c@x.com', token_entrega: 'TOK', consulta_id: 'c1', preview: null, entregue_em: new Date(Date.now() - 3600_000).toISOString(),
    relatorio_snapshot: { consulta: { response: { chassi: r.dados.chassi } }, historicoLeilao: vazio(), historicoVeicular: { ...parsearRespostaHistorico(r)!, consultadoEm: '2026-11-17T20:00:00Z' } },
  })
  return sb
}

beforeEach(() => {
  enviados.length = 0
  chamadas = []
  foraDoAr = false
  _limparTokenParceiro()
  _limparAlertaTeto()
  vi.stubGlobal('useRuntimeConfig', () => CONFIG)
  vi.stubGlobal('sendErrorEmail', async () => {})
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  // Nuxt auto-imports of the snapshot assembly (rebuild): only our auction base matters, empty.
  vi.stubGlobal('getValorCusto', async () => null)
  vi.stubGlobal('detectarSegmento', () => 'carro')
  vi.stubGlobal('decodificarChassi', async () => null)
  vi.stubGlobal('corrigirAnoChassi', (x: any) => x)
  vi.stubGlobal('consultarHistoricoLeilao', async () => vazio())
  vi.stubGlobal('fetch', async (url: string) => {
    chamadas.push(url)
    if (url.endsWith('/api/Auth/login')) return { status: 200, text: async () => JSON.stringify({ token: 'jwt' }) }
    return foraDoAr ? { status: 503, text: async () => 'fora' } : { status: 200, text: async () => JSON.stringify(REAL) }
  })
})

/** The regular retry job of the auction partner (plugin, every 15 min), with the default notifier. */
const retryDoJob = (sb: ReturnType<typeof supabaseMemoria>) => {
  _limparTokenParceiro()
  return rodarJobParceiro({ sb: pedidosComCaminhos(sb).fake, cfg: cfgParceiro(CONFIG, {}), agora: Date.now(), log: () => {}, dono: 'c1', alertar: async () => {} })
}
afterEach(() => { vi.unstubAllGlobals() })

describe('operator route: auction partner fallback without a customer e-mail', () => {
  it('control: the same order through the regular path gets the late auction e-mail', async () => {
    const sb = pedidoComParcial()
    await completarHistoricoVeicular(sb, PEDIDO, { cfg: cfgHistorico(CONFIG), ignorarChave: true, retentar: true })
    expect(pagas()).toBe(1)
    expect(enviados).toHaveLength(1)
  })

  it('the operator run calls the auction partner once (at most one charge) and never e-mails the customer', async () => {
    const sb = pedidoComParcial()
    const r = await completarHistoricoVeicularOperador(sb, PEDIDO, cfgHistorico(CONFIG))
    expect(r).toMatchObject({ pulado: 'ja tem' })
    const linha = sb.tab('pedidos_premium')[0]
    expect(linha.relatorio_snapshot.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true })
    expect(linha.relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(pagas()).toBe(1)
    expect(enviados).toHaveLength(0)
    expect(linha.aviso_leilao_em ?? null).toBeNull()
    // A second operator run: no second charge, still no e-mail.
    await completarHistoricoVeicularOperador(sb, PEDIDO, cfgHistorico(CONFIG))
    expect(pagas()).toBe(1)
    expect(sb.tab('parceiro_leilao_chamadas').filter((l) => l.cobrada)).toHaveLength(1)
    expect(enviados).toHaveLength(0)
  })
})

// Review 2 of PR #758, B1: the operator run marks its fallback (semAviso), so
// the regular retry job, 15 min later, writes the data but sends no e-mail.
describe('operator route: the job retry of its fallback sends no e-mail either', () => {
  it('operator run, auction partner down, then the retry finds an auction: data written, no e-mail', async () => {
    const sb = pedidoComParcial()
    foraDoAr = true
    await completarHistoricoVeicularOperador(sb, PEDIDO, cfgHistorico(CONFIG))
    const linha = sb.tab('pedidos_premium')[0]
    expect(linha.relatorio_snapshot.historicoLeilao.parceiro).toMatchObject({ status: 'falhou', reserva: true, semAviso: true })
    foraDoAr = false
    const r = await retryDoJob(sb)
    expect(r).toMatchObject({ rodou: true, vistos: 1, completados: 1 })
    expect(linha.relatorio_snapshot.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, semAviso: true })
    expect(linha.relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(sb.tab('parceiro_leilao_chamadas').filter((l) => l.cobrada)).toHaveLength(1)
    expect(enviados).toHaveLength(0)
    expect(linha.aviso_leilao_em ?? null).toBeNull()
  })

  it('control: a regular fallback that failed and is retried by the job does e-mail the customer once', async () => {
    const sb = pedidoComParcial()
    foraDoAr = true
    await completarHistoricoVeicular(sb, PEDIDO, { cfg: cfgHistorico(CONFIG), ignorarChave: true, retentar: true })
    expect(sb.tab('pedidos_premium')[0].relatorio_snapshot.historicoLeilao.parceiro).toMatchObject({ status: 'falhou', reserva: true })
    expect(sb.tab('pedidos_premium')[0].relatorio_snapshot.historicoLeilao.parceiro.semAviso).toBeUndefined()
    foraDoAr = false
    await retryDoJob(sb)
    expect(enviados).toHaveLength(1)
  })
})

// Review 3 of PR #758: the admin rebuild of the auction section (rebuildLeilao)
// assembles the block again; it keeps the operator's no-notice mark, so the
// job's retry after it does not e-mail the customer either.
describe('operator route: the mark survives the admin rebuild of the auction section', () => {
  it('operator run (partner down), rebuild (still down), retry (partner back) that finds an auction: no e-mail', async () => {
    const sb = pedidoComParcial()
    const linha = sb.tab('pedidos_premium')[0]
    foraDoAr = true
    await completarHistoricoVeicularOperador(sb, PEDIDO, cfgHistorico(CONFIG))
    expect(linha.relatorio_snapshot.historicoLeilao.parceiro).toMatchObject({ status: 'falhou', reserva: true, semAviso: true })
    // The rebuild calls the partner again (still down) and writes the block it got.
    _limparTokenParceiro()
    const rb = await rebuildLeilao(sb, ['TOK'])
    expect(rb).toEqual([expect.objectContaining({ token: 'TOK', ok: true })])
    expect(linha.relatorio_snapshot.historicoLeilao.parceiro).toMatchObject({ status: 'falhou', reserva: true, semAviso: true })
    expect(linha.relatorio_snapshot.auditoria.historicoLeilaoAnteriores[0].bloco.parceiro.semAviso).toBe(true)
    // The regular retry job, partner back up: the data goes in, no e-mail.
    foraDoAr = false
    const r = await retryDoJob(sb)
    expect(r).toMatchObject({ rodou: true, vistos: 1, completados: 1 })
    expect(linha.relatorio_snapshot.historicoLeilao.parceiro).toMatchObject({ status: 'ok', reserva: true, semAviso: true })
    expect(linha.relatorio_snapshot.historicoLeilao.passagens.length).toBeGreaterThan(0)
    expect(enviados).toHaveLength(0)
    expect(linha.aviso_leilao_em ?? null).toBeNull()
  })
})
