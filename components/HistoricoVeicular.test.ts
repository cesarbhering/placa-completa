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
    expect(t).not.toContain('Troca rápida de dono')
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

  it('current owner under 1 year: alert shown and only that line flagged', () => {
    const base = { tipo: 'pessoa' as const, uf: 'SP', cidade: null, ufCidade: null }
    const atual = { ...base, data: '2026-05-04', tempo: '6 meses', meses: 6, atual: true }
    const antes = { ...base, data: '2025-12-01', tempo: '5 meses', meses: 5, atual: false }
    const w = mount(HistoricoDonos, { props: { tela: telaDonos({ total: 2, atual, ufs: ['SP'], ufZeroKm: null, registros: [atual, antes], semData: 0, trocasRapidas: 1 }, 'carro')!, nomeVeiculo: 'carro' } })
    expect(w.find('.hd-alerta').text()).toBe('Troca rápida de dono: o dono atual está com o carro há menos de 1 ano. Vale perguntar o motivo ao vendedor.')
    expect(w.findAll('.hd-barra--curta')).toHaveLength(1)
    const moto = mount(HistoricoDonos, { props: { tela: telaDonos({ total: 2, atual, ufs: ['SP'], ufZeroKm: null, registros: [atual, antes], semData: 0, trocasRapidas: 1 }, 'moto')!, nomeVeiculo: 'moto' } })
    expect(moto.text()).toContain('Por quantas mãos a moto passou')
    expect(moto.find('.hd-alerta').text()).toContain('o dono atual está com a moto há menos de 1 ano')
  })

  it('two owners: no alert, no "see all"', () => {
    const w = mount(HistoricoDonos, { props: { tela: telaDonos(tela(SEM).donos)! } })
    expect(w.find('.hd-alerta').exists()).toBe(false)
    expect(w.find('button.hd-mais').exists()).toBe(false)
    expect(w.text()).toContain('estado por onde passou')
  })

  it('each line shows the owner type with "City/UF"; a snapshot stored before the city shows only the state', () => {
    const w = mount(HistoricoDonos, { props: { tela: telaDonos(tela(COM).donos)! } })
    // The fixture owner has uf PR and "CIDADE EXEMPLO/PE": the city goes with its own state.
    expect(w.find('.hd-tempo li .hd-quem').text()).toBe('Pessoa · Cidade Exemplo/PE')
    const antigo: any = JSON.parse(JSON.stringify(parsearRespostaHistorico(structuredClone(COM))))
    for (const o of [antigo.donos.atual, ...antigo.donos.registros]) delete o.cidade
    const v = mount(HistoricoDonos, { props: { tela: telaDonos(historicoVeicularParaTela(antigo)!.donos)! } })
    expect(v.find('.hd-tempo li .hd-quem').text()).toBe('Pessoa · PR')
    expect(v.html()).not.toMatch(/null|undefined/)
  })
})

describe('previous use block', () => {
  it('lines with the tone and the clean note (no line for the used-car dealer in the chain)', () => {
    const w = mount(UsoAnterior, { props: { tela: telaUso(tela(COM).uso)! } })
    expect(w.findAll('.ua-linha').map((l) => l.text())).toEqual([
      'Banco ou financeiraEsteve em nome de Banco Exemplo S.A. Arrendamento Mercantil em 2007',
    ])
    expect(w.find('.ua-nota').text()).toBe('Sem registro de locadora, táxi, viatura ou frota pública.')
    expect(w.text()).not.toMatch(/loja de usados|empresa/i)
  })

  // Cesar, 23/11/2026: a used-car dealer or a company does not lower the value of the vehicle.
  it('a used-car dealer next to a rental company: only the rental company line', () => {
    const uso = { ...tela(SEM).uso!, frotista: null, locadora: { ano: '2019' }, empresas: [{ loja: true, ano: '2012' }, { loja: false, ano: '2015' }] }
    const w = mount(UsoAnterior, { props: { tela: telaUso(uso)! } })
    expect(w.findAll('.ua-linha').map((l) => l.text())).toEqual(['LocadoraConsta como ex-frota de locadora (2019)'])
    expect(w.find('.ua-nota').text()).toBe('Sem registro de táxi, viatura ou frota pública.')
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
