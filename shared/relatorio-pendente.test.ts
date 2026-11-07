import { describe, it, expect } from 'vitest'
import {
  relatorioPendente, relatoriosPendentes, aConferir, rotaSemAviso, tokensParaAvisar, lerMostrados, gravarMostrados, CHAVE_AVISO_MOSTRADOS,
} from './relatorio-pendente'
import type { ConsultaLocal } from '../composables/useConsultaHistory'

const item = (o: Partial<ConsultaLocal>): ConsultaLocal => ({
  token: 'tok-a', placa: 'AAA1A11', veiculo: null, status: 'entregue', criadoEm: '', atualizadoEm: '', ...o,
})

describe('pending report detection', () => {
  it('a delivered report never opened on this device is pending', () => {
    expect(relatorioPendente(item({ aberto: false }))).toBe(true)
  })

  it('legacy items without the field count as already opened', () => {
    expect(relatorioPendente(item({}))).toBe(false)
  })

  it('opened reports and reports that are not ready are not pending', () => {
    expect(relatorioPendente(item({ aberto: true }))).toBe(false)
    for (const status of ['aguardando_pagamento', 'pago', 'consultando', 'processando_play', 'expirado', 'reembolsado']) {
      expect(relatorioPendente(item({ status, aberto: false }))).toBe(false)
    }
  })

  it('lists only the pending ones, keeping history order', () => {
    const itens = [
      item({ token: 't1', aberto: false }),
      item({ token: 't2' }),
      item({ token: 't3', aberto: true }),
      item({ token: 't4', aberto: false }),
    ]
    expect(relatoriosPendentes(itens).map((i) => i.token)).toEqual(['t1', 't4'])
  })

  it('only unopened paid orders still in progress are re-checked with the server', () => {
    const itens = [
      item({ token: 't1', status: 'pago', aberto: false }),
      item({ token: 't2', status: 'consultando', aberto: false }),
      item({ token: 't3', status: 'pago' }),
      item({ token: 't4', status: 'aguardando_pagamento', aberto: false }),
      item({ token: 't5', status: 'entregue', aberto: false }),
    ]
    expect(aConferir(itens).map((i) => i.token)).toEqual(['t1', 't2'])
  })
})

describe('where and when the notice shows', () => {
  const base = { itens: [item({ token: 't1', aberto: false })], path: '/', elegivel: true, jaMostrados: [] as string[] }

  it('shows on phone or app outside the report pages', () => {
    expect(tokensParaAvisar(base)).toEqual(['t1'])
    expect(tokensParaAvisar({ ...base, path: '/tabela-fipe' })).toEqual(['t1'])
    expect(tokensParaAvisar({ ...base, path: '/en' })).toEqual(['t1'])
  })

  it('never shows on desktop', () => {
    expect(tokensParaAvisar({ ...base, elegivel: false })).toEqual([])
  })

  it('never shows on /premium pages (report, purchase) or internal screens', () => {
    for (const path of ['/premium/abc', '/premium', '/premium/', '/admin', '/dash']) {
      expect(rotaSemAviso(path)).toBe(true)
      expect(tokensParaAvisar({ ...base, path })).toEqual([])
    }
    expect(rotaSemAviso('/')).toBe(false)
  })

  it('does not show while the app checkout is open', () => {
    expect(tokensParaAvisar({ ...base, checkoutAberto: true })).toEqual([])
  })

  it('shows each report once per session, and again for a report that arrives later', () => {
    expect(tokensParaAvisar({ ...base, jaMostrados: ['t1'] })).toEqual([])
    const comNovo = [item({ token: 't2', aberto: false }), ...base.itens]
    expect(tokensParaAvisar({ ...base, itens: comNovo, jaMostrados: ['t1'] })).toEqual(['t2'])
  })

  it('stores the tokens already shown in session storage', () => {
    const store: Record<string, string> = {}
    const s = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } }
    expect(lerMostrados(s)).toEqual([])
    gravarMostrados(s, ['t1', 't1', 't2'])
    expect(JSON.parse(store[CHAVE_AVISO_MOSTRADOS])).toEqual(['t1', 't2'])
    expect(lerMostrados(s)).toEqual(['t1', 't2'])
    store[CHAVE_AVISO_MOSTRADOS] = 'not json'
    expect(lerMostrados(s)).toEqual([])
    expect(lerMostrados(null)).toEqual([])
  })
})
