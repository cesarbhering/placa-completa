import { describe, it, expect } from 'vitest'
import { ehBaixaDeGravame, dataDaBaixa, textoBaixaGravame, textoDivergenciaBaixa, fraseParecerBaixa, restricoesDetranParaTela, ROTULO_GRAVAME_BAIXADO } from './restricao-detran-classe'
import { efeitoRestricao } from './restricao-efeito'
import { resumoQuitar } from './detran-quitar'
import { montarChecklist, idChecklistValido } from './checklist-compra'
import { tipoRestricaoTexto } from '../server/utils/infosimples-detran'

// MES7B45 (21/out/2026): restricoes_detran do DETRAN-SC no snapshot.
const MES7B45 = [
  { tipo: 'administrativa', texto: 'Restrição de Execução por Certidão' },
  { tipo: 'financeira', texto: 'Alienação Fiduciária em favor de B**** V********* S***' },
  { tipo: 'sng', texto: 'Registro de Baixa de Alienação Fiduciária informado em 17/03/2026' },
]

describe('baixa (quitacao) do gravame nao e restricao', () => {
  it('reconhece baixa, cancelamento, liberacao e quitacao de alienacao/gravame', () => {
    for (const t of [
      'Registro de Baixa de Alienação Fiduciária informado em 17/03/2026',
      'BAIXA DE GRAVAME', 'Gravame baixado em 02/01/2026', 'Cancelamento de alienação fiduciária',
      'Liberação do gravame', 'Alienação fiduciária quitada', 'Quitação do financiamento informada',
    ]) expect(ehBaixaDeGravame({ texto: t }), t).toBe(true)
    expect(ehBaixaDeGravame({ tipo: 'sng', texto: 'Baixa informada em 10/10/2026' })).toBe(true)
    expect(ehBaixaDeGravame({ tipo: 'baixa', texto: '' })).toBe(true)
  })
  it('nao confunde: alienacao ativa, baixa pendente, "nao consta baixa", baixa definitiva do veiculo', () => {
    for (const t of [
      'Alienação Fiduciária em favor de BANCO X', 'GRAVAME ATIVO', 'Baixa de gravame pendente',
      'Aguardando baixa do gravame', 'Não consta baixa de alienação', 'BAIXA DEFINITIVA', 'Veículo baixado',
      'Restrição de Execução por Certidão',
    ]) expect(ehBaixaDeGravame({ texto: t }), t).toBe(false)
  })
  it('precedencia no parser: "Baixa de Alienação" vira baixa, nao financeira', () => {
    expect(tipoRestricaoTexto('Registro de Baixa de Alienação Fiduciária informado em 17/03/2026')).toBe('baixa')
    expect(tipoRestricaoTexto('Alienação Fiduciária em favor de BANCO X')).toBe('financeira')
    expect(tipoRestricaoTexto('Restrição judicial')).toBe('judiciaria')
  })
  it('MES7B45: baixa sai das restricoes reais e das travas; a alienacao ativa fica', () => {
    const t = restricoesDetranParaTela(MES7B45)
    expect(t.reais.map((r) => r.tipo)).toEqual(['administrativa', 'financeira'])
    expect(t.baixas).toEqual([{ texto: 'Registro de Baixa de Alienação Fiduciária informado em 17/03/2026', data: '17/03/2026' }])
    expect(efeitoRestricao(MES7B45[2])).toBeNull()
    expect(efeitoRestricao(MES7B45[1])).not.toBeNull()
  })
  it('so a baixa: nenhuma trava de financiamento, linha "sem restricoes"', () => {
    const t = restricoesDetranParaTela([MES7B45[2]])
    expect(t.reais).toEqual([])
    expect(t.semRestricao).toBe(true)
    const r = resumoQuitar({ bloco: { fonte: 'detran_sc', restricoes_detran: t.reais } as any, ufVeiculo: 'SC', restricoesNacionais: [] })
    expect(r.travas).toEqual([])
  })
  it('copy: data, divergencia, parecer, sem travessao', () => {
    expect(ROTULO_GRAVAME_BAIXADO).toBe('Gravame baixado')
    expect(dataDaBaixa(MES7B45[2].texto)).toBe('17/03/2026')
    expect(textoBaixaGravame('17/03/2026')).toBe('A financeira informou a baixa (quitação) do gravame em 17/03/2026. Se o cadastro ainda mostrar a alienação, peça ao vendedor o documento de quitação; a atualização costuma levar alguns dias.')
    expect(textoBaixaGravame(null)).toBe('A financeira informou a baixa (quitação) do gravame. Se o cadastro ainda mostrar a alienação, peça ao vendedor o documento de quitação; a atualização costuma levar alguns dias.')
    expect(textoDivergenciaBaixa('17/03/2026')).toBe('O cadastro ainda lista alienação fiduciária; a baixa informada em 17/03 pode não ter sido processada.')
    expect(fraseParecerBaixa('17/03/2026', true)).toBe(' A financeira informou a baixa do gravame em 17/03/2026, mas o cadastro ainda lista alienação fiduciária: peça o documento de quitação.')
    expect(fraseParecerBaixa('17/03/2026', false)).toBe(' A financeira informou a baixa do gravame em 17/03/2026: peça o documento de quitação.')
    for (const t of [textoBaixaGravame('17/03/2026'), textoDivergenciaBaixa('17/03/2026'), fraseParecerBaixa(null, true)]) expect(t).not.toContain('—')
  })
  it('checklist: "peça o documento de quitação"', () => {
    const c = montarChecklist({ gravameBaixado: true })
    const it = c.transferencia.find((i) => i.id === 'r-gravame-baixa')!
    expect(it.texto).toMatch(/documento de quitação/)
    expect(idChecklistValido('r-gravame-baixa')).toBe(true)
    expect(montarChecklist({}).transferencia.some((i) => i.id === 'r-gravame-baixa')).toBe(false)
  })
  it('pagina: bloco verde, divergencia e parecer ligados', async () => {
    const { readFileSync } = await import('node:fs')
    const vue = readFileSync('pages/premium/[token].vue', 'utf8')
    expect(vue).toContain('rel__multas-restr--baixa')
    expect(vue).toContain('textoDivergenciaBaixa(bx.data)')
    expect(vue).toContain('+ fraseBaixa.value')
    expect(vue).toContain('gravameBaixado: !!baixaGravame.value')
  })
})
