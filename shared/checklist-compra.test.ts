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

describe('ids estaveis (checklist reativo)', () => {
  it('todo item tem id unico, valido e independente do texto', async () => {
    const { montarChecklist, idChecklistValido, IDS_CHECKLIST } = await import('./checklist-compra')
    const c = montarChecklist({ leilao: 'confirmado', roubo: true, recallPendente: true, kmCaiu: true, gravame: true, restricaoJudicial: true, debitosCentavos: 100, baixado: true })
    const ids = [...c.vistoria, ...c.transferencia].map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(idChecklistValido(id), id).toBe(true)
    expect(new Set(IDS_CHECKLIST).size).toBe(IDS_CHECKLIST.length)
    // texto muda com o valor, id nao
    const a = montarChecklist({ debitosCentavos: 100 }).transferencia[0]
    const b = montarChecklist({ debitosCentavos: 999 }).transferencia[0]
    expect(a.texto).not.toBe(b.texto)
    expect(a.id).toBe(b.id)
    expect(idChecklistValido('x-inventado')).toBe(false)
    expect(idChecklistValido(1)).toBe(false)
  })
})
