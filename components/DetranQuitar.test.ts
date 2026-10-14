import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetranQuitar from './DetranQuitar.vue'
import { resumoQuitar, procedenciaDebitos, procedenciaKm, CONSEQUENCIA_LICENCIAMENTO } from '../shared/detran-quitar'

const montar = (bloco: any, extra: any = {}) => mount(DetranQuitar, { props: { resumo: resumoQuitar({ bloco, ...extra }) } })

describe('caixa "Para transferir" do bloco do DETRAN', () => {
  it('com debitos (PVT3J49, ES): total, linhas por item, sem travas', () => {
    const w = montar({ fonte: 'detran_es', ipva_total_centavos: 301720, licenciamento_centavos: 94816, multas_total_centavos: 19929, licenciamento_atrasado_ano: 2021, restricoes_detran: [] })
    expect(w.find('.dq__tit span').text()).toBe('Para transferir este veículo, falta quitar')
    expect(w.find('.dq__total').text()).toBe('R$ 4.164,65')
    expect(w.findAll('.dq__linhas li').map((l) => `${l.find('span').text()} | ${l.find('b').text()}`)).toEqual(['IPVA em aberto | R$ 3.017,20', 'Licenciamento em aberto | R$ 948,16', 'Multas em aberto | R$ 199,29'])
    expect(w.find('.dq__travas').text()).toBe('Restrições que travam a transferência: nenhuma.')
    expect(w.find('.dq__alerta').text()).toBe(CONSEQUENCIA_LICENCIAMENTO)
    expect(w.text()).not.toContain('—')
  })

  it('sem debitos: "Nada a quitar no DETRAN-SP na data da consulta."', () => {
    const w = montar({ fonte: 'detran_sp', multas_total_centavos: 0, ipva_total_centavos: 0, licenciamento_centavos: 0 })
    expect(w.find('.dq__tit').text()).toBe('Nada a quitar no DETRAN-SP na data da consulta.')
    expect(w.find('.dq__linhas').exists()).toBe(false)
    expect(w.find('.dq__alerta').exists()).toBe(false)
    expect(w.classes()).toContain('dq--ok')
  })

  it('licenciamento atrasado sem valor em aberto: nada a quitar, mas a consequencia aparece', () => {
    const w = montar({ fonte: 'detran_mg', multas_total_centavos: 0, licenciamento_atrasado_ano: 2023 })
    expect(w.find('.dq__tit').text()).toBe('Nada a quitar no DETRAN-MG na data da consulta.')
    expect(w.find('.dq__alerta').text()).toBe(CONSEQUENCIA_LICENCIAMENTO)
  })

  it('travas: DETRAN + base nacional, sem repetir categoria', () => {
    const w = montar({ fonte: 'detran_sp', multas_total_centavos: 0, restricoes_detran: [{ tipo: 'financeira', texto: 'ALIENACAO FIDUCIARIA' }, { tipo: 'outros_debitos', texto: 'x' }] },
      { restricoesNacionais: ['ALIENACAO_FIDUCIARIA_FILE_VEICULOS', 'RESTRICAO_RENAJUD'], indicadorRouboFurto: false })
    expect(w.find('.dq__travas').text()).toBe('Restrições que travam a transferência: Financiamento (alienação ou gravame); Restrição judicial.')
  })

  it('BA: total informado pelo DETRAN manda e a nota diz isso', () => {
    const w = montar({ fonte: 'detran_ba', multas_total_centavos: 10000, multas_atualizado_centavos: 12000, total_detran_centavos: 15000 })
    expect(w.find('.dq__total').text()).toBe('R$ 150,00')
    expect(w.find('.dq__nota').text()).toBe('Total informado pelo próprio DETRAN-BA, com juros e correção.')
  })
})

describe('procedencia e data dos subblocos', () => {
  const ISO = '2026-10-14T16:50:00Z' // 13:50 em Brasilia
  it('ok: consultado em', () => {
    expect(procedenciaDebitos({ uf: 'SP', consultadoEm: ISO, estado: 'ok' })).toBe('Débitos e multas · DETRAN-SP · consultado em 14/10/2026 13:50')
  })
  it('protegido e indisponivel: data da tentativa', () => {
    expect(procedenciaDebitos({ uf: 'MG', consultadoEm: ISO, estado: 'protegido' })).toBe('Débitos e multas · DETRAN-MG · tentativa em 14/10/2026 13:50')
    expect(procedenciaDebitos({ uf: 'GO', consultadoEm: ISO, estado: 'indisponivel' })).toBe('Débitos e multas · DETRAN-GO · tentativa em 14/10/2026 13:50')
    expect(procedenciaDebitos({ uf: 'GO', consultadoEm: null, estado: 'indisponivel' })).toBe('Débitos e multas · DETRAN-GO')
  })
  it('quilometragem: fontes distintas e ultima leitura', () => {
    expect(procedenciaKm({ uf: 'SP', fontes: ['DETRAN', 'DETRAN', 'Honda (recall)'], ultimaData: '02/05/2026' })).toBe('Quilometragem · DETRAN-SP + Honda (recall) · última leitura 02/05/2026')
  })
})

describe('resumo por item abaixo da caixa: so status, sem repetir valores', () => {
  it('com debitos: "Em aberto" / "Atrasado (2020)", nenhum R$', async () => {
    const { statusResumoDetran } = await import('../shared/detran-quitar')
    const rows = statusResumoDetran({ fonte: 'detran_sp', multas_total_centavos: 297056, licenciamento_centavos: 0, licenciamento_atrasado_ano: 2020, ipva_total_centavos: 0 }, { anoAtual: 2026 })
    expect(rows.map((r) => `${r.rotulo}: ${r.valor}`)).toEqual(['Multas: Em aberto', 'Licenciamento: Atrasado (2020)', 'IPVA: Em dia'])
    expect(JSON.stringify(rows)).not.toContain('R$')
  })
  it('licenciamento em aberto com vencimento e sem atraso: "Em aberto, vence dd/mm/aaaa"', async () => {
    const { statusResumoDetran } = await import('../shared/detran-quitar')
    const rows = statusResumoDetran({ fonte: 'detran_sc', multas_total_centavos: 30961, licenciamento_centavos: 14937, licenciamento_venc: '2026-10-31', ipva_total_centavos: 66932, ultimo_licenciamento_ano: 2026 }, { anoAtual: 2026 })
    expect(rows.map((r) => r.valor)).toEqual(['Em aberto', 'Em aberto, vence 31/10/2026', 'Em aberto'])
    expect(rows.every((r) => r.alerta)).toBe(true)
  })
  it('sem debitos: tudo em dia / nada consta (verde)', async () => {
    const { statusResumoDetran } = await import('../shared/detran-quitar')
    const rows = statusResumoDetran({ fonte: 'detran_es', multas_total_centavos: 0, licenciamento_centavos: 0, ipva_total_centavos: 0, ultimo_licenciamento_ano: 2026 }, { anoAtual: 2026 })
    expect(rows.map((r) => r.valor)).toEqual(['Nada consta', 'Em dia', 'Em dia'])
    expect(rows.every((r) => r.emDia)).toBe(true)
  })
  it('RENAINF de fora do estado: mantem o texto aprovado', async () => {
    const { statusResumoDetran } = await import('../shared/detran-quitar')
    const rows = statusResumoDetran({ fonte: 'detran_es', multas_total_centavos: 0 }, { renainfForaTexto: 'No DETRAN-ES: nada consta. ...' })
    expect(rows[0]).toMatchObject({ rotulo: 'Multas em aberto', texto: 'No DETRAN-ES: nada consta. ...' })
  })
})
