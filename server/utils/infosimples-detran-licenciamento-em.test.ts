// @vitest-environment node
import { describe, it, expect } from 'vitest'
import MG from './__fixtures__/infosimples-detran-mg.json'
import PA from './__fixtures__/infosimples-detran-pa-veiculo.json'
import ES from './__fixtures__/infosimples-detran-es.json'
import RSV from './__fixtures__/infosimples-detran-rs-veiculo.json'
import { dataLicenciamentoIso, blocoDetranDaUf, parsearVeiculoRs, juntarComplemento } from './infosimples-detran'

// Data do licenciamento no DETRAN (licenciamento_em, ISO): so MG, PA, ES e RS
// informam. O /detran/sp/debitos NAO traz data (ultimo_licenciamento =
// "exercicio 2026"), nem data de pagamento.
describe('licenciamento_em', () => {
  it('formatos: "3/4/2024", "17/11/2022", texto do ES; lixo -> null', () => {
    expect(dataLicenciamentoIso('3/4/2024')).toBe('2024-04-03')
    expect(dataLicenciamentoIso('17/11/2022')).toBe('2022-11-17')
    expect(dataLicenciamentoIso('2026 em 08/07/2026 através do Registro de Veículo (CRV)(Via 1) 2026')).toBe('2026-07-08')
    expect(dataLicenciamentoIso('exercicio 2026')).toBeNull()
    expect(dataLicenciamentoIso(null)).toBeNull()
    expect(dataLicenciamentoIso('40/13/2024')).toBeNull()
  })
  it('fixtures reais: MG, PA e ES gravam a data', () => {
    expect((blocoDetranDaUf('MG', MG) as any).licenciamento_em).toBe('2024-04-03')
    expect((blocoDetranDaUf('PA', PA) as any).licenciamento_em).toBe('2022-11-17')
    expect((blocoDetranDaUf('ES', ES) as any).licenciamento_em).toBe('2026-07-08')
  })
  it('RS: complemento /veiculo traz ultimo exercicio e a data, e o bloco recebe', () => {
    const comp = parsearVeiculoRs(RSV, new Date('2026-10-14T12:00:00-03:00'))!
    expect(comp).toMatchObject({ ultimo_licenciamento_ano: 2024, licenciamento_em: '2024-06-27' })
    const b = juntarComplemento({ fonte: 'detran_rs', status: 'ok', multas_total_centavos: 0 }, comp)
    expect(b).toMatchObject({ ultimo_licenciamento_ano: 2024, licenciamento_em: '2024-06-27' })
  })
})
