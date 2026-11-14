// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Vehicle history partner together with the paid query (Cesar, 13/11/2026):
// started right after the order is claimed, before the paid query, never
// awaited by the delivery; written into the snapshot right after it.

const ordem: string[] = []
vi.mock('./parceiro-historico', () => ({
  // Never answers: if the delivery waited for it, the test would hang.
  iniciarHistoricoVeicular: vi.fn(() => { ordem.push('fonte'); return new Promise(() => {}) }),
  completarHistoricoVeicularDepois: vi.fn(() => { ordem.push('completar') }),
}))
vi.mock('./renajud-detalhe', () => ({ completarRenajudDepois: vi.fn() }))
vi.mock('./entrega-pedido', () => ({ gravarEntrega: vi.fn(async () => { ordem.push('entrega'); return null }) }))
vi.mock('./aviso-venda', () => ({ avisarVenda: vi.fn(async () => {}) }))
vi.mock('./nfse', () => ({ enfileirarNfse: vi.fn(async () => {}), cancelarNfse: vi.fn(async () => {}) }))
vi.mock('./gcc-reserva', () => ({ ambienteDaConsultaPaga: () => 'homolog' }))
vi.mock('./cupom-recompra', () => ({ gerarCupomRecompra: vi.fn(async () => null) }))
vi.mock('./tarefas-em-voo', () => ({ emVoo: (_n: string, fn: () => any) => Promise.resolve().then(fn) }))
vi.mock('./premium-jobs', () => ({ criarJobsDaEntrega: vi.fn(async () => 0) }))
vi.mock('./fotos-na-geracao', () => ({ completarFotosNaGeracao: vi.fn(async () => {}) }))
vi.mock('./fotos-depois', () => ({ agendarFotosRapido: vi.fn() }))

const { processarPedidoPago } = await import('./premium-processar')
const { iniciarHistoricoVeicular, completarHistoricoVeicularDepois } = await import('./parceiro-historico')

function banco() {
  const q: any = {}
  for (const m of ['update', 'eq', 'in', 'select', 'is']) q[m] = () => q
  q.then = (ok: any, erro: any) => Promise.resolve({ data: [{ id: 'p1' }], error: null }).then(ok, erro)
  return { from: () => q }
}
const pedido = (x: any = {}) => ({ id: 'p1', placa: 'TST2B34', email: null, token_entrega: 'TokenFicticioDeTeste0003', abacatepay_id: 'cobranca-teste', plano: 'completa', ambiente: 'homolog', ...x })

beforeEach(() => {
  ordem.length = 0
  vi.mocked(iniciarHistoricoVeicular).mockClear()
  vi.mocked(completarHistoricoVeicularDepois).mockClear()
  vi.stubGlobal('useRuntimeConfig', () => ({}))
  vi.stubGlobal('consultarSenatran', vi.fn(async () => { ordem.push('senatran'); return { consultaId: 'c1', trace: [], placaConsultada: 'TST2B34', response: { chassi: '' } } }))
  vi.stubGlobal('montarRelatorioSnapshot', vi.fn(async () => { ordem.push('snapshot'); return { consulta: null } }))
  vi.stubGlobal('enviarRelatorioEmail', vi.fn(async () => true))
  vi.stubGlobal('sendErrorEmail', vi.fn(async () => {}))
  vi.stubGlobal('ehErroDeRede', () => false)
  vi.stubGlobal('esperar', async () => {})
  vi.stubGlobal('temRecallPendente', () => false)
  vi.stubGlobal('completarRecallMontadoraDepois', () => {})
  vi.stubGlobal('completarDetranDepois', () => {})
  vi.stubGlobal('provedorDoPedido', () => ({ reembolsarPix: async () => ({ ok: true }) }))
  vi.stubGlobal('deveAvisarClienteEstorno', () => false)
  vi.stubGlobal('enviarEstornoEmail', async () => true)
})

describe('vehicle history partner in the paid order flow', () => {
  it('Completa: starts before the paid query, the delivery does not wait for it, written right after the snapshot', async () => {
    const sb = banco()
    await processarPedidoPago(sb, pedido())
    expect(ordem).toEqual(['fonte', 'senatran', 'entrega', 'snapshot', 'completar'])
    expect(vi.mocked(iniciarHistoricoVeicular).mock.calls[0][0]).toBe(sb)
    expect(vi.mocked(iniciarHistoricoVeicular).mock.calls[0][1]).toMatchObject({ id: 'p1', placa: 'TST2B34', plano: 'completa' })
  })

  it('Basica: never starts', async () => {
    await processarPedidoPago(banco(), pedido({ plano: 'basica' }))
    expect(iniciarHistoricoVeicular).not.toHaveBeenCalled()
    expect(completarHistoricoVeicularDepois).not.toHaveBeenCalled()
  })

  it('paid query fails and the order is refunded: the call had already started (its cost stays recorded)', async () => {
    vi.stubGlobal('consultarSenatran', vi.fn(async () => { ordem.push('senatran'); throw new Error('HTTP 404 veiculo nao encontrado') }))
    await processarPedidoPago(banco(), pedido())
    expect(ordem).toEqual(['fonte', 'senatran'])
    expect(completarHistoricoVeicularDepois).not.toHaveBeenCalled()
  })
})
