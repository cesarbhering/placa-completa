import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { tipoDoModeloCesta, nomeSemTipo, fraseComposicao } from './seguro-eletrico-cesta'
import cesta from '../data/seguro-eletricos.json'

describe('cesta /seguro/carro-eletrico: eletrico x hibrido explicito', () => {
  it('tipo por modelo', () => {
    expect(tipoDoModeloCesta('Nissan Leaf (elétrico)')).toBe('Elétrico')
    expect(tipoDoModeloCesta('Chevrolet Bolt (elétrico)')).toBe('Elétrico')
    expect(tipoDoModeloCesta('Renault Zoe (elétrico)')).toBe('Elétrico')
    expect(tipoDoModeloCesta('Toyota Prius (híbrido)')).toBe('Híbrido')
    expect(tipoDoModeloCesta('Toyota Corolla Hybrid')).toBe('Híbrido')
    expect(nomeSemTipo('Toyota Prius (híbrido)')).toBe('Toyota Prius')
    expect(nomeSemTipo('Toyota Corolla Hybrid')).toBe('Toyota Corolla Hybrid')
  })
  it('frase da composicao: mista, so hibridos; sem travessao', () => {
    expect(fraseComposicao([{ nome: 'Nissan Leaf (elétrico)' }, { nome: 'Toyota Prius (híbrido)' }]))
      .toBe('Da cesta desta região, é 100% elétrico: Nissan Leaf; é híbrido (motor a combustão junto com o elétrico): Toyota Prius.')
    expect(fraseComposicao([{ nome: 'Toyota Prius (híbrido)' }, { nome: 'Toyota Corolla Hybrid' }]))
      .toBe('Nesta região a base de apólices só tem híbridos, que não são carros elétricos: Toyota Prius e Toyota Corolla Hybrid. A média acima é desses híbridos.')
    for (const v of Object.values(cesta as Record<string, any>)) expect(fraseComposicao(v.modelos)).not.toContain('—')
  })
  it('paginas mostram o tipo', () => {
    const est = readFileSync('pages/seguro/carro-eletrico/[estado].vue', 'utf8')
    expect(est).toContain('<th>Tipo</th>')
    expect(est).toContain('fraseComposicao(dados.modelos)')
    const idx = readFileSync('pages/seguro/carro-eletrico/index.vue', 'utf8')
    expect(idx).toContain('Híbrido não é carro elétrico')
  })
})
