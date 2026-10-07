import { describe, it, expect, beforeEach } from 'vitest'
import {
  dentroDoTetoDeEdital, _limparTetoDeEdital, TETO_POR_TOKEN,
  refPertenceAoRelatorio, relatorioPodeBaixarEdital,
} from './edital-leilao'

const snap = (passagens: any[]) => ({ historicoLeilao: { passagens } })

describe('o edital pertence a este relatorio?', () => {
  const comEdital = snap([
    { fonte_tipo: 'detran', edital_disponivel: true, edital_ref: 'abc123.deadbeef1234' },
    { fonte_tipo: 'privado', edital_disponivel: false, edital_ref: null },
  ])

  it('ref da propria passagem passa', () => {
    expect(refPertenceAoRelatorio(comEdital, 'abc123.deadbeef1234')).toBe(true)
  })

  // O risco central: sem esta checagem, um ref copiado de qualquer lugar
  // transformaria o endpoint num proxy de download da base inteira, pago pela
  // nossa chave.
  it('ref de outro relatorio nao passa', () => {
    expect(refPertenceAoRelatorio(comEdital, 'outro999.abcdef123456')).toBe(false)
  })

  it('passagem sem edital disponivel nao libera, mesmo com ref', () => {
    const sem = snap([{ fonte_tipo: 'detran', edital_disponivel: false, edital_ref: 'x.y' }])
    expect(refPertenceAoRelatorio(sem, 'x.y')).toBe(false)
  })

  it('relatorio antigo, sem historico no snapshot, nao quebra', () => {
    expect(refPertenceAoRelatorio({}, 'x.y')).toBe(false)
    expect(refPertenceAoRelatorio(null, 'x.y')).toBe(false)
    expect(refPertenceAoRelatorio(snap([]), 'x.y')).toBe(false)
  })

  it('ref vazio nunca passa', () => {
    expect(refPertenceAoRelatorio(comEdital, '')).toBe(false)
  })
})

describe('este relatorio pode baixar edital?', () => {
  it('completa entregue pode', () => {
    expect(relatorioPodeBaixarEdital({ status: 'entregue', plano: 'completa' })).toBe(true)
    expect(relatorioPodeBaixarEdital({ status: 'pago', plano: 'completa' })).toBe(true)
  })

  it('basica nao: e conteudo da completa, mesma muralha do historico', () => {
    expect(relatorioPodeBaixarEdital({ status: 'entregue', plano: 'basica' })).toBe(false)
  })

  it('quem ainda nao pagou nao baixa nada', () => {
    expect(relatorioPodeBaixarEdital({ status: 'aguardando_pagamento', plano: 'completa' })).toBe(false)
    expect(relatorioPodeBaixarEdital({ status: 'expirado', plano: 'completa' })).toBe(false)
    expect(relatorioPodeBaixarEdital({ status: 'reembolsado', plano: 'completa' })).toBe(false)
    expect(relatorioPodeBaixarEdital(null)).toBe(false)
  })
})

describe('teto por relatorio', () => {
  beforeEach(() => _limparTetoDeEdital())

  it('deixa o uso normal passar e corta o exagero', () => {
    for (let i = 0; i < TETO_POR_TOKEN; i++) expect(dentroDoTetoDeEdital('tok')).toBe(true)
    expect(dentroDoTetoDeEdital('tok')).toBe(false)
  })

  it('um relatorio nao gasta a cota do outro', () => {
    for (let i = 0; i <= TETO_POR_TOKEN; i++) dentroDoTetoDeEdital('tok-a')
    expect(dentroDoTetoDeEdital('tok-b')).toBe(true)
  })

  it('a janela reabre depois de uma hora', () => {
    const t0 = Date.now()
    for (let i = 0; i <= TETO_POR_TOKEN; i++) dentroDoTetoDeEdital('tok', t0)
    expect(dentroDoTetoDeEdital('tok', t0)).toBe(false)
    expect(dentroDoTetoDeEdital('tok', t0 + 60 * 60 * 1000 + 1)).toBe(true)
  })
})

describe('edital de notificacao', () => {
  it('nunca pertence ao relatorio, nem em snapshot antigo', () => {
    const s = snap([{ edital_disponivel: true, edital_ref: 'r1', situacao: 'notificado' }])
    expect(refPertenceAoRelatorio(s, 'r1')).toBe(false)
  })
})

describe('edital judicial de casa privada', () => {
  it('ref de passagem privada marcada como disponivel pertence ao relatorio', () => {
    const s = { historicoLeilao: { passagens: [{ fonte: 'superbid', fonte_tipo: 'privado', edital_disponivel: true, edital_ref: 'j1.abc' }] } }
    expect(refPertenceAoRelatorio(s, 'j1.abc')).toBe(true)
    expect(refPertenceAoRelatorio(s, 'outro')).toBe(false)
  })
})
