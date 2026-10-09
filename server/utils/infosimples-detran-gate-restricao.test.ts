import { describe, it, expect } from 'vitest'
import { passaNoGateDetran } from './infosimples-detran'
import { temRestricaoNacional } from '../../shared/restricoes'
import { normalizarResposta } from '../../shared/planos'

// RDW7C71 (Outlander SC, 09/out): so RENAJUD, sem RENAINF, e o DETRAN-SC nao
// era chamado. O gate passa a aceitar qualquer restricao do registro nacional.
const RDW = [{ ufJurisdicao: 'SC', restricoes: { indicadorMultaRenainf: false, indicadorRestricaoRenajud: true, items: [{ tipoRestricao: 'RENAJUD' }] } }]

describe('gate do DETRAN estadual', () => {
  it('RENAJUD sem RENAINF: chama', () => {
    expect(passaNoGateDetran('renainf', RDW)).toBe(true)
  })
  it('so o indicador de restricao aceso (sem item na lista): chama', () => {
    expect(passaNoGateDetran('renainf', [{ restricoes: { indicadorRestricaoRfb: true, items: [] } }])).toBe(true)
    expect(passaNoGateDetran('renainf', [{ restricoes: { indicadorRouboFurto: true } }])).toBe(true)
  })
  it('gravame na lista: chama', () => {
    expect(passaNoGateDetran('renainf', [{ restricoes: { items: [{ tipoRestricao: 'ALIENACAO_FIDUCIARIA' }] } }])).toBe(true)
  })
  it('nada consta, so recall ou multa ja coberta: comportamento de antes', () => {
    expect(passaNoGateDetran('renainf', [{ restricoes: { items: [] } }])).toBe(false)
    expect(passaNoGateDetran('renainf', [{ restricoes: { indicadorRecall: true, items: [{ tipoRestricao: 'RECALL' }] } }])).toBe(false)
    expect(passaNoGateDetran('renainf', [{ restricoes: { indicadorMultaRenainf: true } }])).toBe(true)
  })
  it('SP: sempre', () => {
    expect(passaNoGateDetran('sempre', [{}])).toBe(true)
  })
  it('temRestricaoNacional usa a resposta normalizada', () => {
    expect(temRestricaoNacional(normalizarResposta(RDW))).toBe(true)
    expect(temRestricaoNacional(null)).toBe(false)
  })
})
