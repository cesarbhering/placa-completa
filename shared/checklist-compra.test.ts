import { describe, expect, it } from 'vitest'
import { montarChecklist } from './checklist-compra'

describe('checklist de vistoria e transferencia', () => {
  it('sem sinal: so os itens gerais', () => {
    const c = montarChecklist({})
    expect(c.vistoria.every((i) => !i.doRelatorio)).toBe(true)
    expect(c.transferencia.every((i) => !i.doRelatorio)).toBe(true)
    expect(c.vistoria.length).toBeGreaterThan(5)
  })
  it('sinais do relatorio vem primeiro e marcados', () => {
    const c = montarChecklist({ leilao: 'confirmado', roubo: true, recallPendente: true, kmCaiu: true, gravame: true, restricaoJudicial: true, debitosCentavos: 41377, licenciamentoAtrasado: true })
    expect(c.vistoria.filter((i) => i.doRelatorio)).toHaveLength(4)
    expect(c.vistoria[0].texto).toContain('leilão')
    const t = c.transferencia.filter((i) => i.doRelatorio).map((i) => i.texto.replace(/\s/g, ' '))
    expect(t).toHaveLength(3)
    expect(t[0]).toMatch(/^Consta gravame/)
    expect(t[1]).toMatch(/^Consta restrição judicial/)
    expect(t[2]).toMatch(/^Há R\$ 413,77 a quitar/)
  })
  it('licenciamento atrasado sem debito em valor', () => {
    expect(montarChecklist({ licenciamentoAtrasado: true }).transferencia[0].texto).toContain('licenciamento atrasado')
  })
  it('copy: sem travessao, sem orgao federal, sem afirmar defeito', () => {
    const c = montarChecklist({ leilao: 'possivel', roubo: true, recallPendente: true, kmCaiu: true, gravame: true, restricaoJudicial: true, debitosCentavos: 100, baixado: true })
    const tudo = [...c.vistoria, ...c.transferencia].map((i) => i.texto).join('\n')
    expect(tudo).not.toContain('—')
    expect(tudo).not.toMatch(/senatran|denatran|renavam|\bsenad|ministério|federal/i)
    expect(tudo).not.toMatch(/está (batido|adulterado|com defeito)|foi adulterad|tem defeito/i)
  })
})
