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

describe('sem resumo duplicado (feedback do Cesar, 14/out)', () => {
  it('sem bloco estadual: status so pela base nacional', async () => {
    const { statusBaseNacional } = await import('../shared/detran-quitar')
    expect(statusBaseNacional({ renainf: true, licAno: '2020' }).map((r) => `${r.rotulo}: ${r.valor}`))
      .toEqual(['Multas (base nacional): Consta multa em aberto', 'Último licenciamento (base nacional): 2020'])
    expect(statusBaseNacional({ renainf: false, licAno: null }).map((r) => r.valor)).toEqual(['Nada consta'])
    expect(statusBaseNacional({ renainf: undefined, licAno: undefined })).toEqual([])
  })

  it('template: ordem procedencia, caixa, infracoes, IPVA, restricoes; quilometragem na linha do tempo; sem as repeticoes', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const vue = readFileSync(join(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    const ordem = ['{{ procDebitos }}', '<DetranQuitar', '>Multas em aberto</p>', '>IPVA em aberto</p>', '>Restrições no DETRAN</p>']
    const pos = ordem.map((m) => vue.indexOf(m))
    expect(pos.every((p) => p > 0)).toBe(true)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    for (const fora of ['multasBreakdown', 'Licenciamento atrasado: o último exercício', 'Multas (Pix)', 'multasDetalhe.alerta_roubo_furto']) expect(vue).not.toContain(fora)
    expect(vue).toContain('v-if="ipvaLista.itens.length >= 2"')
    expect(vue).not.toContain('>Quilometragem registrada</p>')
    expect(vue).toContain('hodometro: kmLeituras.value')
  })
})

describe('AL: IPVA apontado, valor vindo da SEFAZ', () => {
  it('pendente: linha "IPVA em aberto" sem valor, sem "Nada a quitar"', async () => {
    const { mount } = await import('@vue/test-utils')
    const { default: C } = await import('./DetranQuitar.vue')
    const { resumoQuitar } = await import('../shared/detran-quitar')
    const w = mount(C, { props: { resumo: resumoQuitar({ bloco: { fonte: 'detran_al', multas_total_centavos: 0, ipva_pendente_sefaz: true } }) } })
    expect(w.text()).not.toContain('Nada a quitar')
    expect(w.find('.dq__pendente').text()).toContain('consultando a SEFAZ-AL')
  })
})
