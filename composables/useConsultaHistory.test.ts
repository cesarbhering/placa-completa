import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const estados = new Map<string, any>()
vi.stubGlobal('useState', (k: string, init: () => any) => {
  if (!estados.has(k)) estados.set(k, ref(init()))
  return estados.get(k)
})

const { useConsultaHistory, relatorioPendente } = await import('./useConsultaHistory')
const KEY = 'pc_consultas_v1'

beforeEach(() => {
  localStorage.clear()
  estados.clear()
})

describe('useConsultaHistory: opened flag', () => {
  it('new items start unopened and become pending once delivered', () => {
    const h = useConsultaHistory()
    h.add({ token: 'tok-1', placa: 'AAA1A11', status: 'pago' })
    expect(h.itens.value[0].aberto).toBe(false)
    expect(relatorioPendente(h.itens.value[0])).toBe(false)
    h.updateStatus('tok-1', 'entregue')
    expect(relatorioPendente(h.itens.value[0])).toBe(true)
  })

  it('legacy items saved before the field existed are not pending', () => {
    localStorage.setItem(KEY, JSON.stringify([{ token: 'tok-old', placa: 'BBB2B22', veiculo: null, status: 'entregue', criadoEm: '', atualizadoEm: '' }]))
    const h = useConsultaHistory()
    h.sync()
    expect(relatorioPendente(h.itens.value[0])).toBe(false)
  })

  it('re-adding an existing order keeps its opened state (including legacy)', () => {
    localStorage.setItem(KEY, JSON.stringify([{ token: 'tok-old', placa: 'BBB2B22', veiculo: null, status: 'pago', criadoEm: '', atualizadoEm: '' }]))
    const h = useConsultaHistory()
    h.add({ token: 'tok-old', placa: 'BBB2B22', status: 'entregue', aberto: false })
    expect(h.itens.value[0].aberto).toBeUndefined()
    expect(relatorioPendente(h.itens.value[0])).toBe(false)

    h.add({ token: 'tok-2', placa: 'CCC3C33', status: 'entregue' })
    h.marcarAberto('tok-2')
    h.add({ token: 'tok-2', placa: 'CCC3C33', status: 'entregue' })
    expect(h.itens.value.find((i) => i.token === 'tok-2')?.aberto).toBe(true)
  })

  it('marking as opened takes the report out of pending and persists', () => {
    const h = useConsultaHistory()
    h.add({ token: 'tok-1', placa: 'AAA1A11', status: 'entregue' })
    h.marcarAberto('tok-1')
    expect(relatorioPendente(h.itens.value[0])).toBe(false)
    expect(JSON.parse(localStorage.getItem(KEY)!)[0].aberto).toBe(true)
    h.marcarAberto('unknown')
  })

  it('the report page marks the report as opened when it is delivered', () => {
    const src = readFileSync(resolve(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    const marcacoes = src.match(/if \(data\.value\??\.status === 'entregue'\) marcarAberto\(token\)/g) || []
    // on mount and when the live poll sees the delivery
    expect(marcacoes.length).toBe(2)
  })
})
