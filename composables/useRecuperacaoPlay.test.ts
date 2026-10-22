import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  rodarRecuperacao, lerComprasGuardadas, compraDaPlaca, proximoIntervalo, consultarPedidoPlay,
  STATUS_PROCESSANDO_PLAY, DESCONHECIDA_ESQUECE_MS, type HistoricoDeps, type RespostaPedidoPlay,
} from './useRecuperacaoPlay'
import type { ConsultaLocal } from './useConsultaHistory'

// A Play devolveu "pendente" pro app, o servidor concluiu pela RTDN e o app
// nunca soube o token de entrega. Aqui: o app guarda a compra, a gente acha o
// pedido pelo comprovante, poe em "Suas consultas" e manda o app esquecer.

function ponte(compras: any[]) {
  let lista = [...compras]
  return {
    listPurchases: vi.fn(() => JSON.stringify(lista)),
    removePurchase: vi.fn((t: string) => { lista = lista.filter((c) => c.purchaseToken !== t) }),
  }
}

function historico(inicial: Partial<ConsultaLocal>[] = []): HistoricoDeps & { itens: ConsultaLocal[] } {
  const h: any = { itens: inicial.map((i) => ({ veiculo: null, criadoEm: '', atualizadoEm: '', status: 'pago', placa: '', ...i })) }
  h.ler = () => h.itens
  h.add = (e: any) => { h.itens = [{ veiculo: null, criadoEm: '', atualizadoEm: '', status: 'aguardando_pagamento', ...e }, ...h.itens.filter((x: any) => x.token !== e.token)] }
  h.updateStatus = (t: string, s: string) => { h.itens = h.itens.map((x: any) => (x.token === t ? { ...x, status: s } : x)) }
  h.remove = (t: string) => { h.itens = h.itens.filter((x: any) => x.token !== t) }
  return h
}

const compra = { purchaseToken: 'tok-abc', orderId: 'GPA.1', productId: 'consulta_completa', placa: 'abc1d23', savedAt: Date.now() }
const pronto = (token = 'entrega-1'): RespostaPedidoPlay => ({ tipo: 'pronto', token, status: 'entregue', placa: 'ABC1D23' })

describe('rodarRecuperacao', () => {
  it('pedido pronto: entra em Suas consultas, troca o provisorio e o app esquece a compra', async () => {
    const p = ponte([compra])
    const h = historico([{ token: 'play:GPA.1', placa: 'ABC1D23', status: STATUS_PROCESSANDO_PLAY, veiculo: 'Fiat Uno' }])
    const r = await rodarRecuperacao({ ponte: p, consultar: async () => pronto(), historico: h })
    expect(r).toEqual({ prontos: [{ token: 'entrega-1', placa: 'ABC1D23' }], pendentes: 0 })
    expect(h.itens).toHaveLength(1)
    expect(h.itens[0]).toMatchObject({ token: 'entrega-1', placa: 'ABC1D23', status: 'entregue', veiculo: 'Fiat Uno' })
    expect(p.removePurchase).toHaveBeenCalledWith('tok-abc')
  })

  it('provisorio sem id (pending sem token) casa pela placa', async () => {
    const h = historico([{ token: 'play:ABC1D23-1700000000000', placa: 'ABC1D23', status: STATUS_PROCESSANDO_PLAY }])
    await rodarRecuperacao({ ponte: ponte([compra]), consultar: async () => pronto(), historico: h })
    expect(h.itens.map((i) => i.token)).toEqual(['entrega-1'])
  })

  it('pedido ja no historico: so atualiza o status', async () => {
    const h = historico([{ token: 'entrega-1', placa: 'ABC1D23', status: 'pago' }])
    await rodarRecuperacao({ ponte: ponte([compra]), consultar: async () => pronto(), historico: h })
    expect(h.itens).toEqual([expect.objectContaining({ token: 'entrega-1', status: 'entregue' })])
  })

  it('manda o e-mail digitado junto', async () => {
    const consultar = vi.fn(async () => pronto())
    await rodarRecuperacao({ ponte: ponte([compra]), consultar, historico: historico(), email: 'ana@ex.com' })
    expect(consultar).toHaveBeenCalledWith('tok-abc', 'ana@ex.com')
  })

  it('pendente: conta e mantem a compra no app', async () => {
    const p = ponte([compra])
    const r = await rodarRecuperacao({ ponte: p, consultar: async () => ({ tipo: 'pendente' }), historico: historico() })
    expect(r.pendentes).toBe(1)
    expect(p.removePurchase).not.toHaveBeenCalled()
  })

  it('desconhecida: espera 24 h antes de esquecer', async () => {
    const agora = Date.now()
    const nova = ponte([{ ...compra, savedAt: agora - 60_000 }])
    expect((await rodarRecuperacao({ ponte: nova, consultar: async () => ({ tipo: 'desconhecida' }), historico: historico(), agora })).pendentes).toBe(1)
    expect(nova.removePurchase).not.toHaveBeenCalled()
    const velha = ponte([{ ...compra, savedAt: new Date(agora - DESCONHECIDA_ESQUECE_MS - 1).toISOString() }])
    await rodarRecuperacao({ ponte: velha, consultar: async () => ({ tipo: 'desconhecida' }), historico: historico(), agora })
    expect(velha.removePurchase).toHaveBeenCalledWith('tok-abc')
  })

  it('cancelada: some o provisorio e o app esquece', async () => {
    const p = ponte([compra])
    const h = historico([{ token: 'play:GPA.1', placa: 'ABC1D23', status: STATUS_PROCESSANDO_PLAY }])
    await rodarRecuperacao({ ponte: p, consultar: async () => ({ tipo: 'cancelada' }), historico: h })
    expect(h.itens).toEqual([])
    expect(p.removePurchase).toHaveBeenCalled()
  })

  it('app antigo sem ponte: nada acontece', async () => {
    const consultar = vi.fn()
    expect(await rodarRecuperacao({ ponte: null, consultar, historico: historico() })).toEqual({ prontos: [], pendentes: 0 })
    expect(consultar).not.toHaveBeenCalled()
  })
})

describe('ponte do app', () => {
  it('JSON torto ou item sem token vira lista limpa', () => {
    expect(lerComprasGuardadas({ listPurchases: () => 'lixo', removePurchase: () => {} })).toEqual([])
    expect(lerComprasGuardadas({ listPurchases: () => '[{"placa":"X"},{"purchaseToken":"t"}]', removePurchase: () => {} })).toEqual([{ purchaseToken: 't' }])
  })

  it('compraDaPlaca pega a mais recente da placa', () => {
    const p = ponte([
      { purchaseToken: 'velha', placa: 'ABC1D23', savedAt: 1 },
      { purchaseToken: 'nova', placa: 'ABC-1D23', savedAt: 5 },
      { purchaseToken: 'outra', placa: 'XYZ9A88', savedAt: 9 },
    ])
    expect(compraDaPlaca('abc1d23', p)?.purchaseToken).toBe('nova')
    expect(compraDaPlaca('QQQ1A11', p)).toBeNull()
  })
})

describe('consultarPedidoPlay', () => {
  beforeEach(() => { (globalThis as any).$fetch = vi.fn() })

  it('sem e-mail usa GET; com e-mail, POST', async () => {
    const f = (globalThis as any).$fetch.mockResolvedValue({ token_entrega: 'e1', status: 'pago', placa: 'ABC1D23' })
    expect(await consultarPedidoPlay('tok')).toEqual({ tipo: 'pronto', token: 'e1', status: 'pago', placa: 'ABC1D23' })
    expect(f.mock.calls[0]).toEqual(['/api/premium/google-play/pedido', { query: { purchaseToken: 'tok' } }])
    await consultarPedidoPlay('tok', 'ana@ex.com')
    expect(f.mock.calls[1]).toEqual(['/api/premium/google-play/pedido', { method: 'POST', body: { purchaseToken: 'tok', email: 'ana@ex.com' } }])
  })

  it('traduz 202, 404, 410 e falha de rede', async () => {
    const f = (globalThis as any).$fetch
    f.mockResolvedValueOnce({ pendente: true })
    expect((await consultarPedidoPlay('t')).tipo).toBe('pendente')
    f.mockRejectedValueOnce({ statusCode: 404 })
    expect((await consultarPedidoPlay('t')).tipo).toBe('desconhecida')
    f.mockRejectedValueOnce({ response: { status: 410 } })
    expect((await consultarPedidoPlay('t')).tipo).toBe('cancelada')
    f.mockRejectedValueOnce(new Error('rede'))
    expect((await consultarPedidoPlay('t')).tipo).toBe('erro')
  })
})

describe('proximoIntervalo', () => {
  it('ritmo pedido nos 2 primeiros minutos, depois espaca', () => {
    expect(proximoIntervalo(5_000, 30_000)).toBe(5_000)
    expect(proximoIntervalo(5_000, 5 * 60_000)).toBe(20_000)
    expect(proximoIntervalo(10_000, 30 * 60_000)).toBe(60_000)
  })
})
