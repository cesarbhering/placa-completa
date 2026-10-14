import { describe, it, expect } from 'vitest'
import { faixaLicenciamento, NOTA_BASE_NACIONAL } from './licenciamento-faixa'

describe('faixa de licenciamento: DETRAN da UF manda sobre a base nacional', () => {
  it('DEI0D43: base nacional 2023 + DETRAN-SP 2026 em dia -> "Em dia" com a fonte', () => {
    const f = faixaLicenciamento({
      anoNacional: '2023', emissaoNacional: '10/05/2023',
      estadual: { fonte: 'detran_sp', ultimo_licenciamento_ano: 2026, licenciamento_atrasado_ano: null },
      anoAtual: 2026,
    })
    expect(f).toEqual({ ano: '2026', tom: 'ok', rotulo: 'Em dia', fonte: ' no DETRAN-SP', licenciadoEm: null, emissao: null, nota: null })
  })

  it('base nacional 2026 + DETRAN atrasado 2024 -> "Atrasado" pelo estado', () => {
    const f = faixaLicenciamento({
      anoNacional: '2026',
      estadual: { uf: 'MG', ultimo_licenciamento_ano: 2024, licenciamento_atrasado_ano: 2024, licenciamento_em: '2024-04-03' },
      anoAtual: 2026,
    })
    expect(f).toMatchObject({ ano: '2024', tom: 'alerta', rotulo: 'Atrasado', fonte: ' no DETRAN-MG', licenciadoEm: '03/04/2024', emissao: null })
  })

  it('estado sem atraso marcado e ano anterior: "Confira" (calendario da UF)', () => {
    const f = faixaLicenciamento({ anoNacional: null, estadual: { fonte: 'detran_rs', ultimo_licenciamento_ano: 2025 }, anoAtual: 2026 })
    expect(f).toMatchObject({ tom: 'atencao', rotulo: 'Confira', fonte: ' no DETRAN-RS' })
  })

  it('bloco estadual sem ano de licenciamento: cai na base nacional com o aviso', () => {
    const f = faixaLicenciamento({ anoNacional: '2023', emissaoNacional: '10/05/2023', estadual: { fonte: 'detran_ce', ultimo_licenciamento_ano: null }, anoAtual: 2026 })
    expect(f).toMatchObject({ ano: '2023', tom: 'alerta', rotulo: 'Atrasado', fonte: null, emissao: '10/05/2023' })
    expect(f!.nota).toBe(`Ano ${NOTA_BASE_NACIONAL}.`)
  })

  it('so base nacional: regra antiga + nota de defasagem; sem nada: null', () => {
    expect(faixaLicenciamento({ anoNacional: '2026', anoAtual: 2026 })).toMatchObject({ tom: 'ok', rotulo: 'Em dia', fonte: null })
    expect(faixaLicenciamento({ anoNacional: '2025', anoAtual: 2026 })!.nota).toBe(`O licenciamento 2026 pode ainda estar no prazo do calendário da UF. Ano ${NOTA_BASE_NACIONAL}.`)
    expect(faixaLicenciamento({ anoNacional: null, estadual: null })).toBeNull()
  })

  it('texto sem travessao', () => {
    const f = faixaLicenciamento({ anoNacional: '2025', anoAtual: 2026 })
    expect(JSON.stringify(f)).not.toContain('—')
  })
})
