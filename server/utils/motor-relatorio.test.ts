import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { RECURSOS, inclui, recursosNovosNoPlano, RECURSOS_BLOQUEADOS } from '../../shared/planos'
import { RECURSOS_EN } from '../../shared/planos-en'

// Engine number (Nov 9, 2026): paid reports only, Basica and Completa.
// All values are invented.
const MOTOR = 'ZZT123456'

vi.mock('./placa-lookup', async (orig) => {
  const real: any = await orig()
  return {
    ...real,
    consultarPlacaWdapi: vi.fn(async (placa: string) => (placa === 'TST1A23' ? { MARCA: 'VW', extra: { motor: MOTOR } } : null)),
  }
})

describe('engine number in the plan ladder', () => {
  const linha = RECURSOS.find((r) => r.label === 'Número do motor')

  it('is listed for Basica and Completa, never for the free lookup', () => {
    expect(linha).toBeDefined()
    expect(inclui(linha!, 'basica')).toBe(true)
    expect(inclui(linha!, 'completa')).toBe(true)
    expect(inclui(linha!, 'gratis')).toBe(false)
  })

  it('shows up as a Basica novelty and in the locked list of the free result', () => {
    expect(recursosNovosNoPlano('basica').map((r) => r.label)).toContain('Número do motor')
    expect(RECURSOS_BLOQUEADOS.map((r) => r.label)).toContain('Número do motor')
  })

  it('has an English label', () => {
    expect(RECURSOS_EN['Número do motor']).toBe('Engine number')
  })
})

describe('engine number in the paid report', () => {
  it('motorDaPlaca reads it through the plate lookup and fails open', async () => {
    const { motorDaPlaca } = await import('./relatorio-snapshot')
    expect(await motorDaPlaca('TST1A23')).toBe(MOTOR)
    expect(await motorDaPlaca('TST9Z99')).toBeNull()
  })

  it('the report API only returns it for a delivered order', () => {
    const src = readFileSync('server/api/premium/report.get.ts', 'utf8')
    expect(src).toMatch(/motor: !pendente && pedido\.status === 'entregue' \? \(motor \?\? null\) : null,/)
  })

  it('the report page renders it in the registration table for both plans', () => {
    const vue = readFileSync('pages/premium/[token].vue', 'utf8')
    const ficha = vue.slice(vue.indexOf('const fichaCadastral'), vue.indexOf('const fichaTecnica'))
    expect(ficha).toContain("linha('Número do motor', data.value?.motor)")
    // not gated by plan on the page: the server already limits it to paid orders
    expect(ficha).not.toMatch(/Número do motor[^\n]*completa/)
  })
})

describe('engine number never reaches the free result', () => {
  it('the free lookup strips it right after the plate lookup', () => {
    const src = readFileSync('server/api/consulta.post.ts', 'utf8')
    expect(src).toMatch(/apiResponse = semMotor\(lookup\.payload\)/)
    // the only place the raw lookup payload is used
    expect(src.match(/lookup\.payload/g)).toHaveLength(1)
  })

  it('the checkout preview does not pick the engine number', () => {
    const src = readFileSync('server/api/premium/preview.post.ts', 'utf8')
    expect(src).not.toMatch(/motor/i)
  })
})
