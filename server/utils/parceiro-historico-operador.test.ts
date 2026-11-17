// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import REAL from './__fixtures__/parceiro-leilao-real.json'
import SEM from './__fixtures__/parceiro-historico-sem-registros.json'
import { supabaseMemoria } from '../../tests/helpers/supabase-memoria'

// Customer e-mails of the late auction notice, captured (the real notifier runs).
const { enviados } = vi.hoisted(() => ({ enviados: [] as any[] }))
vi.mock('./premium-email', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  enviarAvisoLeilao: vi.fn(async (m: any) => { enviados.push(m); return true }),
}))

import { completarHistoricoVeicular, completarHistoricoVeicularOperador } from './parceiro-historico'
import { cfgHistorico } from './parceiro-historico-env'
import { _limparTokenParceiro } from './parceiro-leilao'
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
const pagas = () => chamadas.filter((u) => !u.endsWith('/api/Auth/login')).length

/** An order whose stored vehicle history is partial and shows no auction: what the auction partner finds is news. */
function pedidoComParcial() {
  const r: any = structuredClone(SEM)
  r.dados.raw_sources.e5Success = false
  const sb = supabaseMemoria()
  sb.tab('pedidos_premium').push({
    ...PEDIDO, status: 'entregue', email: 'c@x.com', token_entrega: 'TOK',
    relatorio_snapshot: { consulta: { response: { chassi: r.dados.chassi } }, historicoLeilao: vazio(), historicoVeicular: { ...parsearRespostaHistorico(r)!, consultadoEm: '2026-11-17T20:00:00Z' } },
  })
  return sb
}

beforeEach(() => {
  enviados.length = 0
  chamadas = []
  _limparTokenParceiro()
  vi.stubGlobal('useRuntimeConfig', () => CONFIG)
  vi.stubGlobal('fetch', async (url: string) => {
    chamadas.push(url)
    const corpo = url.endsWith('/api/Auth/login') ? { token: 'jwt' } : REAL
    return { status: 200, text: async () => JSON.stringify(corpo) }
  })
})
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
