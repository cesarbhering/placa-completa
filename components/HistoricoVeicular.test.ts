import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import COM from '../server/utils/__fixtures__/parceiro-historico-com-registros.json'
import SEM from '../server/utils/__fixtures__/parceiro-historico-sem-registros.json'
import { parsearRespostaHistorico, historicoVeicularParaTela, telaDonos, telaUso, telaSinistro } from '../shared/historico-veicular'
import HistoricoDonos from './HistoricoDonos.vue'
import UsoAnterior from './UsoAnterior.vue'
import SinistroSeguro from './SinistroSeguro.vue'

// The three blocks of the vehicle history partner, from what the report JSON
// carries (historicoVeicularParaTela), as the page builds them.
const tela = (fx: any) => historicoVeicularParaTela(parsearRespostaHistorico(structuredClone(fx)))!

describe('owners block', () => {
  it('counts, current owner, states, alert; five most recent and "see all"', async () => {
    const w = mount(HistoricoDonos, { props: { tela: telaDonos(tela(COM).donos, 'carro')!, nomeVeiculo: 'carro' } })
    const t = w.text()
    expect(t).toContain('Por quantas mãos o carro passou')
    expect(t).toContain('12donos encontrados')
    expect(t).toContain('8 anos e 4 mesescom o dono atual, desde 12/07/2017')
    expect(t).toContain('PR · BA · GO')
    expect(t).toContain('zero km em PR')
    expect(t).toContain('Troca rápida de dono: 6 donos ficaram menos de 1 ano com o carro.')
    expect(w.findAll('.hd-tempo li')).toHaveLength(9)
    expect(w.findAll('.hd-tempo li.hd-extra')).toHaveLength(4)
    expect(w.find('.hd-tempo li').text()).toContain('Dono atual, há 8 anos e 4 meses')
    const botao = w.find('button.hd-mais')
    expect(botao.text()).toBe('Ver os 9 registros com data')
    await botao.trigger('click')
    expect(w.findAll('.hd-tempo li.hd-extra')).toHaveLength(0)
    expect(w.find('button.hd-mais').text()).toBe('Mostrar só os 5 mais recentes')
    expect(t).toContain('em conformidade com a LGPD')
    expect(w.html()).not.toMatch(/FICTICIA|000\.000/)
  })

  it('two owners: no alert, no "see all"', () => {
    const w = mount(HistoricoDonos, { props: { tela: telaDonos(tela(SEM).donos)! } })
    expect(w.find('.hd-alerta').exists()).toBe(false)
    expect(w.find('button.hd-mais').exists()).toBe(false)
    expect(w.text()).toContain('estado por onde passou')
  })
})

describe('previous use block', () => {
  it('lines with the tone and the clean note', () => {
    const w = mount(UsoAnterior, { props: { tela: telaUso(tela(COM).uso)! } })
    expect(w.findAll('.ua-linha').map((l) => l.text())).toEqual([
      'Loja de usadosPassou por loja de usados em 2012',
      'Banco ou financeiraEsteve em nome de Banco Exemplo S.A. Arrendamento Mercantil em 2007',
    ])
    expect(w.find('.ua-nota').text()).toBe('Sem registro de locadora, táxi, viatura ou frota pública.')
  })
})

describe('insurance block', () => {
  it('total loss and damage with the high risk opinion', () => {
    const w = mount(SinistroSeguro, { props: { tela: telaSinistro(tela(COM).sinistro, 'carro')! } })
    expect(w.findAll('.ss-linha dt').map((d) => d.text())).toEqual(['Indenização integral', 'Dano registrado'])
    expect(w.find('.ss-chip--alerta').text()).toBe('Sim')
    expect(w.find('.ss-parecer--alerta strong').text()).toBe('Alto risco de o seguro ser recusado')
    expect(w.text()).toContain('Cada seguradora tem a sua regra de aceitação.')
  })
})
