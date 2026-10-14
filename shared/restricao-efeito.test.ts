import { describe, it, expect } from 'vitest'
import { efeitoRestricao, textoEfeito } from './restricao-efeito'

const txt = (e: any) => textoEfeito(efeitoRestricao(e))

describe('o que cada restricao bloqueia (item 12)', () => {
  it('RENAJUD com tipo informado: afirma', () => {
    expect(txt({ tipo: 'Transferência', texto: 'RENAJUD' })).toBe('Bloqueia: transferência.')
    expect(txt({ tipo: 'Licenciamento', texto: 'RENAJUD' })).toBe('Bloqueia: transferência e licenciamento.')
    expect(txt({ tipo: 'Circulação', texto: 'RENAJUD' })).toBe('Bloqueia: transferência, licenciamento e circulação. O veículo não pode rodar e pode ser recolhido.')
    expect(txt({ tipo: 'Penhora', texto: 'RENAJUD' })).toBe('Bloqueia: transferência. O veículo garante uma dívida no processo e pode ir a leilão judicial.')
  })
  it('judicial sem tipo: "pode bloquear", sem afirmar alem do dado', () => {
    expect(txt({ tipo: 'judiciaria', texto: 'BLOQUEIO JUDICIAL - RENAJUD' })).toBe('Pode bloquear: transferência, licenciamento e circulação. Depende do tipo de restrição que o juiz registrou.')
    expect(txt({ texto: 'Restrição judicial (RENAJUD)' })).toMatch(/^Pode bloquear/)
  })
  it('gravame, roubo, administrativa, beneficio fiscal', () => {
    expect(txt({ tipo: 'financeira', texto: 'ALIENACAO FIDUCIARIA' })).toBe('Bloqueia: transferência. Até a quitação e a baixa do gravame pela financeira.')
    expect(txt({ texto: 'Alienação fiduciária (veículo financiado)' })).toMatch(/^Bloqueia: transferência\./)
    expect(efeitoRestricao({ tipo: 'furto', texto: 'ROUBO' })!.bloqueia).toEqual(['transferência', 'licenciamento', 'circulação'])
    expect(txt({ tipo: 'administrativa', texto: 'REST. ADMINISTRATIVA' })).toBe('Pode bloquear: transferência e licenciamento. Depende do motivo registrado pelo órgão.')
    expect(txt({ texto: 'Benefício fiscal (Zona Franca de Manaus)' })).toMatch(/^Pode bloquear: transferência\. Antes do fim/)
  })
  it('o que nao bloqueia: null; sem travessao', () => {
    expect(efeitoRestricao({ tipo: 'outros_debitos', texto: 'Seguro em aberto' })).toBeNull()
    expect(efeitoRestricao({ texto: 'Comunicação de venda' })).toBeNull()
    for (const e of [{ tipo: 'Circulação', texto: 'RENAJUD' }, { texto: 'ALIENACAO' }, { texto: 'JUDICIAL' }]) expect(txt(e)).not.toContain('—')
  })
})
