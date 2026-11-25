import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { cardRecallAssociado, type RecallBase } from '../shared/recall-associado'
import { recallDetailsLabel, RECALL_DESCRIPTION_LABEL } from '../shared/recall-details'

// Recall cards of the paid report (Cesar, 24/11/2026): the long risk and
// what-to-do texts, and the long campaign descriptions, fold into a closed
// <details> so the card stays short. The campaign name stays in view. On paper
// the texts print open. All data below is made up.
const vue = readFileSync('pages/premium/[token].vue', 'utf8')
const inicio = vue.indexOf('<div v-if="recallMontadora"')
const cards = vue.slice(inicio, vue.lastIndexOf('</template>', vue.indexOf('</section>', inicio)))
const print = vue.slice(vue.indexOf('@page { size: A4'), vue.indexOf('</style>', vue.indexOf('@page { size: A4')))

const RISCO = 'Em uso prolongado, a peça fictícia pode se soltar do suporte e deixar de funcionar. ' +
  'Sem ela, o motorista perde parte do controle em curvas fechadas, o que aumenta o risco de acidente. ' +
  'O problema não dá aviso no painel e pode surgir em qualquer velocidade, mesmo com o carro em bom estado de conservação geral.'
const O_QUE_FAZER = 'Agende na concessionária a troca gratuita da peça fictícia, com o chassi em mãos.'
const DESCRICAO = 'Foi identificada, em veículos de um lote fictício, a possibilidade de trinca no suporte da peça de teste. ' +
  'Em caso de falha, a peça pode se desprender durante a condução, com risco de acidente e de danos aos ocupantes e a terceiros.'

function campanha(codigo: string, nome: string, extra: Record<string, string> = {}) {
  return { codigo, nome, modelo: 'MODELO TESTE', ano_modelo: '2019', inicio: '2021-05-10', nivel: 'firme' as const, ...extra }
}

const BASE: RecallBase = {
  consultado: true, sinal: 'firme', fonte: 'base_recalls',
  campanhas: [
    campanha('T01', 'Peça fictícia do eixo', { risco: RISCO, oQueFazer: O_QUE_FAZER }),
    campanha('T02', 'Peça fictícia do freio', { risco: RISCO }),
    campanha('T03', 'Peça fictícia do banco', { oQueFazer: O_QUE_FAZER }),
    campanha('T04', 'Peça fictícia do painel'),
  ],
}

function montar(over: Record<string, unknown>) {
  const ctx = {
    recallMontadora: null, campanhasAbertas: [], campanhasRealizadas: [], nomeMontadora: 'montadora',
    dadosRecallMontadora: null, metaCampanhaRealizada: () => '', RECALL_ORIENTACAO: 'O reparo é gratuito.',
    cardAssociado: null, recallPendente: false, recallAbertoGM: false, recallCampanhasGM: [],
    recallSubtitulo: '', recallCampanhas: [], legendaCampanha: (c: any) => `Campanha ${c.campanha}`,
    recallEua: null, componenteEua: (s: string) => s, recallDetailsLabel, RECALL_DESCRIPTION_LABEL,
    ...over,
  }
  return mount({ template: `<div class="rel">${cards}</div>`, setup: () => ctx })
}

/** Text of an element without the content of its <details>: what shows while folded. */
function textoFechado(el: Element): string {
  const copia = el.cloneNode(true) as Element
  copia.querySelectorAll('details').forEach((d) => d.remove())
  return copia.textContent || ''
}

describe('associated recall card: risk and what to do fold into a closed accordion', () => {
  const card = cardRecallAssociado({ sinal: 'firme', base: BASE, pendente: false, montadoraComCampanhas: false })
  const w = montar({ cardAssociado: card })
  const itens = w.findAll('.rel__recall--assoc .rel__recall-item')

  it('renders one item per campaign', () => {
    expect(itens).toHaveLength(4)
  })

  it('the campaign with both texts gets a closed accordion with both inside, in order', () => {
    const det = itens[0].find('details.rel__recall-details')
    expect(det.exists()).toBe(true)
    expect(det.attributes('open')).toBeUndefined()
    expect((det.element as HTMLDetailsElement).open).toBe(false)
    expect(det.find('summary').text()).toBe('Ver o risco e o que fazer')
    const paragrafos = det.findAll('p').map((p) => p.text())
    expect(paragrafos).toEqual([`Risco: ${RISCO}`, `O que fazer: ${O_QUE_FAZER}`])
  })

  it('the long texts are not shown while the accordion is closed; the name stays', () => {
    const fechado = textoFechado(itens[0].element)
    expect(fechado).toContain('Peça fictícia do eixo')
    expect(fechado).not.toContain(RISCO.slice(0, 40))
    expect(fechado).not.toContain(O_QUE_FAZER.slice(0, 40))
  })

  it('a campaign with only the risk says "Ver o risco"', () => {
    const det = itens[1].find('details.rel__recall-details')
    expect(det.find('summary').text()).toBe('Ver o risco')
    expect(det.text()).toContain(RISCO)
    expect(det.text()).not.toContain('O que fazer')
  })

  it('a campaign with only what to do says "Ver o que fazer"', () => {
    const det = itens[2].find('details.rel__recall-details')
    expect(det.find('summary').text()).toBe('Ver o que fazer')
    expect(det.text()).toContain(O_QUE_FAZER)
    expect(det.text()).not.toContain('Risco')
  })

  it('a campaign without either text gets no accordion', () => {
    expect(itens[3].find('details').exists()).toBe(false)
    expect(itens[3].text()).toContain('Peça fictícia do painel')
  })

  it('no dash in what the card shows', () => {
    expect(w.text()).not.toMatch(/[—–]/)
  })
})

describe('other recall cards with long descriptions', () => {
  it('manufacturer lookup card: the title stays, the description folds', () => {
    const w = montar({
      recallAbertoGM: true,
      recallCampanhasGM: [{ titulo: 'Suporte fictício do eixo', descricao: DESCRICAO }, { titulo: 'Campanha só com título' }],
    })
    const card = w.find('.rel__recall')
    const dets = card.findAll('details.rel__recall-details')
    expect(dets).toHaveLength(1)
    expect(dets[0].attributes('open')).toBeUndefined()
    expect(dets[0].find('summary').text()).toBe('Ver a descrição')
    expect(dets[0].text()).toContain(DESCRICAO)
    const fechado = textoFechado(card.element)
    expect(fechado).toContain('Suporte fictício do eixo')
    expect(fechado).toContain('Campanha só com título')
    expect(fechado).not.toContain(DESCRICAO.slice(0, 40))
  })

  it('public record card: the component stays, the description folds', () => {
    const w = montar({
      recallPendente: true,
      recallSubtitulo: '2 campanhas pendentes',
      recallCampanhas: [
        { campanha: 'X1', data_inicio: '10/05/2021', componente: 'Suporte do eixo', descricao: DESCRICAO },
        { campanha: 'X2', data_inicio: '11/06/2022', componente: 'Cinto de segurança', descricao: null },
      ],
    })
    const card = w.find('.rel__recall')
    const dets = card.findAll('details.rel__recall-details')
    expect(dets).toHaveLength(1)
    expect(dets[0].attributes('open')).toBeUndefined()
    expect(dets[0].find('summary').text()).toBe('Ver a descrição')
    expect(dets[0].text()).toContain(DESCRICAO)
    const fechado = textoFechado(card.element)
    expect(fechado).toContain('Componente: Suporte do eixo.')
    expect(fechado).toContain('Componente: Cinto de segurança.')
    expect(fechado).not.toContain(DESCRICAO.slice(0, 40))
  })

  it('manufacturer-by-chassis card (titles only) is unchanged: no accordion', () => {
    const w = montar({
      recallMontadora: { fonte: 'nissan', campanhas: [{ titulo: 'Campanha fictícia', codigo: 'N1', status: 'aberto' }] },
      campanhasAbertas: [{ titulo: 'Campanha fictícia', codigo: 'N1', status: 'aberto' }],
    })
    expect(w.find('.rel__recall').exists()).toBe(true)
    expect(w.find('details').exists()).toBe(false)
  })
})

describe('on paper the folded texts print open', () => {
  it('the print handler opens every <details> under .rel, which reaches the new accordions', () => {
    expect(vue).toContain("document.querySelectorAll<HTMLDetailsElement>('.rel details')")
    const card = cardRecallAssociado({ sinal: 'firme', base: BASE, pendente: false, montadoraComCampanhas: false })
    const w = montar({ cardAssociado: card })
    const alcancados = [...w.element.querySelectorAll('details')].filter((d) => d.closest('.rel'))
    expect(alcancados.filter((d) => d.classList.contains('rel__recall-details'))).toHaveLength(3)
  })

  it('print CSS shows closed <details> content and hides the "Ver ..." line of the new accordions', () => {
    expect(print).toContain('details::details-content { content-visibility: visible; display: block; }')
    expect(print).toMatch(/\.rel__recall-details > summary \{ display: none; \}/)
  })
})
