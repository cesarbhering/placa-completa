import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ligadoPeloMotor, NOTA_MOTOR, NOTA_NIVEL } from './leilao-exibicao'

describe('auction record linked by engine number', () => {
  it('engine number as the only identifier is flagged', () => {
    expect(ligadoPeloMotor({ evidencias: ['numero do motor igual', 'marca compativel', 'ano igual'] })).toBe(true)
    expect(ligadoPeloMotor({ evidencias: ['Número do motor igual'] })).toBe(true)
  })

  it('a full VIN, plate or RENAVAM match wins over the engine number', () => {
    expect(ligadoPeloMotor({ evidencias: ['numero do motor igual', 'chassi completo igual'] })).toBe(false)
    expect(ligadoPeloMotor({ evidencias: ['numero do motor igual', 'placa completa igual'] })).toBe(false)
    expect(ligadoPeloMotor({ evidencias: ['numero do motor igual', 'renavam igual'] })).toBe(false)
  })

  it('records without an engine match are not flagged', () => {
    expect(ligadoPeloMotor({ evidencias: ['chassi completo igual'] })).toBe(false)
    expect(ligadoPeloMotor({ evidencias: [] })).toBe(false)
    expect(ligadoPeloMotor({})).toBe(false)
    expect(ligadoPeloMotor(null)).toBe(false)
  })

  it('has its own level note, different from "placa ou chassi iguais"', () => {
    expect(NOTA_MOTOR).toBe('ligado pelo número do motor')
    expect(NOTA_MOTOR).not.toBe(NOTA_NIVEL.confirmado)
    expect(NOTA_MOTOR).not.toMatch(/—/)
  })

  it('the auction card uses the engine note when flagged', () => {
    const ficha = readFileSync('components/LeilaoFicha.vue', 'utf8')
    expect(ficha).toContain('p.value.ligadoPorMotor ? NOTA_MOTOR : NOTA_NIVEL[p.value.nivel]')
    const pagina = readFileSync('pages/premium/[token].vue', 'utf8')
    expect(pagina).toContain('ligadoPorMotor: ligadoPeloMotor(p),')
  })

  it('the paid report sends the engine number to the auction lookup', () => {
    const snap = readFileSync('server/utils/relatorio-snapshot.ts', 'utf8')
    const bloco = snap.slice(snap.indexOf('consultarHistoricoLeilao({'), snap.indexOf('}, { cache: true'))
    expect(bloco).toContain('motor: await motorDoPedido(),')
    expect(bloco).not.toContain('motor: null')
  })
})
