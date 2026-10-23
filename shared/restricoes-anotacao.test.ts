import { describe, it, expect } from 'vitest'
import { itemAnotacao, itemInformativo, itensQueRestringem, anotacoesDoCadastro, fraseParecerAnotacoes, chavesSemCopy, temRestricaoNacional, ROTULO_ANOTACAO, TITULO_ANOTACOES } from './restricoes'
import { montarChecklist, IDS_CHECKLIST, idChecklistValido } from './checklist-compra'

// Caso MES7B45 (21/out/2026): SUSPENSAO_MODIFICADA aparecia como "Restrição" com
// a copy generica ("condiciona ou impede a transferência").
const MES7B45 = ['RENAINF', 'ALIENACAO_FIDUCIARIA_FILE_VEICULOS', 'SUSPENSAO_MODIFICADA']

describe('anotacao no cadastro (alteracao de caracteristica)', () => {
  it('SUSPENSAO_MODIFICADA: copy aprovada, sem travessao, sem alarme', () => {
    const a = itemAnotacao('SUSPENSAO_MODIFICADA')!
    expect(a.titulo).toBe('Suspensão modificada')
    expect(a.texto).toBe('Consta no cadastro uma alteração de característica: suspensão modificada (rebaixada ou elevada) registrada e regularizada. Não impede a transferência. Confira se o documento traz a anotação e se o veículo está como registrado.')
    expect(itemInformativo('SUSPENSAO_MODIFICADA')).toBeNull()
  })
  it('rotulos da categoria', () => {
    expect(ROTULO_ANOTACAO).toBe('Anotação no cadastro')
    expect(TITULO_ANOTACOES).toBe('Anotações no cadastro')
  })
  it('codigos e variantes reconhecidos', () => {
    const casos: Record<string, string> = {
      SUSPENSAO_MODIFICADA: 'Suspensão modificada', 'SUSPENSAO MODIFICADA': 'Suspensão modificada', REBAIXADO: 'Suspensão modificada',
      ALTERACAO_CARACTERISTICA: 'Alteração de característica', ALTERACAO_CARACTERISTICAS: 'Alteração de característica',
      ALTERACAO_DE_CARACTERISTICA: 'Alteração de característica',
      SISTEMA_GNV: 'Sistema de GNV instalado', GNV: 'Sistema de GNV instalado', KIT_GAS: 'Sistema de GNV instalado',
      BLINDADO: 'Veículo blindado', BLINDAGEM: 'Veículo blindado',
      TETO_SOLAR: 'Teto solar instalado', CAMBIO_ALTERADO: 'Câmbio alterado', COR_ALTERADA: 'Cor alterada', MOTOR_ALTERADO: 'Motor alterado',
      TANQUE_SUPLEMENTAR: 'Tanque suplementar', CHASSI_ALONGADO: 'Chassi alongado',
    }
    for (const [cod, titulo] of Object.entries(casos)) {
      expect(itemAnotacao(cod)?.titulo, cod).toBe(titulo)
      expect(itemAnotacao(cod)!.texto, cod).not.toContain('—')
      expect(itemAnotacao(cod)!.texto, cod).toMatch(/[Nn]ão (impede|é bloqueio)/)
    }
  })
  it('restricao de verdade nao vira anotacao', () => {
    for (const cod of ['ALIENACAO_FIDUCIARIA_FILE_VEICULOS', 'RENAJUD', 'ROUBO_FURTO', 'CHASSI_REMARCADO', 'ALTERACAO_DOC', 'RENAINF', 'PRINCIPAL_CONDUTOR']) {
      expect(itemAnotacao(cod), cod).toBeNull()
    }
  })
  it('MES7B45: anotacao sai das restricoes e do indicador; nao cai na copy generica', () => {
    expect(itensQueRestringem(MES7B45)).toEqual(['RENAINF', 'ALIENACAO_FIDUCIARIA_FILE_VEICULOS'])
    expect(anotacoesDoCadastro(MES7B45).map((a) => a.titulo)).toEqual(['Suspensão modificada'])
    expect(chavesSemCopy(MES7B45)).toEqual([])
  })
  it('so anotacao: nao e restricao nacional (gate do DETRAN e grade)', () => {
    expect(temRestricaoNacional({ restricoesItens: ['SUSPENSAO_MODIFICADA'] })).toBe(false)
    expect(temRestricaoNacional({ restricoesItens: ['SUSPENSAO_MODIFICADA', 'RENAJUD'] })).toBe(true)
  })
  it('anotacoesDoCadastro: sem repetir', () => {
    expect(anotacoesDoCadastro(['GNV', 'SISTEMA_GNV', 'TETO_SOLAR']).map((a) => a.titulo)).toEqual(['Sistema de GNV instalado', 'Teto solar instalado'])
    expect(anotacoesDoCadastro(null)).toEqual([])
  })
  it('parecer: frase neutra, singular e plural', () => {
    expect(fraseParecerAnotacoes([])).toBe('')
    expect(fraseParecerAnotacoes(['Suspensão modificada'])).toBe(' Consta anotação no cadastro (suspensão modificada), que não impede a transferência: confira no documento.')
    expect(fraseParecerAnotacoes(['Suspensão modificada', 'Sistema de GNV instalado'])).toBe(' Consta anotações no cadastro (suspensão modificada e sistema de GNV instalado), que não impedem a transferência: confira no documento.')
  })
  it('checklist: item "confira a anotação no documento", id aceito pelo servidor', () => {
    const c = montarChecklist({ anotacoes: ['Suspensão modificada'] })
    const it = c.vistoria.find((i) => i.id === 'r-anotacao')!
    expect(it.doRelatorio).toBe(true)
    expect(it.texto).toBe('Consta anotação no cadastro (suspensão modificada): confira a anotação no documento e se o veículo está como registrado.')
    expect(IDS_CHECKLIST).toContain('r-anotacao')
    expect(idChecklistValido('r-anotacao')).toBe(true)
    expect(montarChecklist({}).vistoria.some((i) => i.id === 'r-anotacao')).toBe(false)
  })
})

describe('pagina: bloco neutro de anotacoes', () => {
  it('a lista de restricoes tira as anotacoes e o bloco cinza existe (tela e papel)', async () => {
    const { readFileSync } = await import('node:fs')
    const vue = readFileSync('pages/premium/[token].vue', 'utf8')
    expect(vue).toContain('.filter((r: any) => !itemAnotacao(r))')
    expect(vue).toContain('class="rel__anot"')
    expect(vue).toContain('rel__tag--anot')
    expect(vue).toMatch(/\.rel__multas-restr, \.rel__anot \{/)
    expect(vue).toContain('anotacoes: anotacoes.value.map((a) => a.titulo)')
  })
})
