import { describe, it, expect } from 'vitest'
import { sinalDaResposta, fraseSinalNaTela } from './sinal-leilao-resposta'

describe('leitura da resposta do sinal de leilao', () => {
  it('achou: vira sinal positivo com a contagem', () => {
    expect(sinalDaResposta({ positivo: true, quantidade: 2 })).toEqual({ positivo: true, quantidade: 2, tipo: 'leilao' })
  })

  it('revenda de frota atravessa so como booleano', () => {
    expect(sinalDaResposta({ positivo: false, quantidade: 0, frota: true })).toEqual({ positivo: false, quantidade: 0, tipo: 'leilao', frota: true })
  })

  it('base respondeu sem registro: vira sinal negativo, que PODE ir pra tela', () => {
    expect(sinalDaResposta({ positivo: false, quantidade: 0 })).toEqual({ positivo: false, quantidade: 0, tipo: 'leilao' })
  })

  it('indisponivel vira null: a tela nao fala de leilao', () => {
    // O caso que importa: timeout, servico fora, teto de uso.
    expect(sinalDaResposta({ positivo: null, quantidade: 0 })).toBeNull()
    expect(sinalDaResposta({})).toBeNull()
    expect(sinalDaResposta(null)).toBeNull()
    expect(sinalDaResposta(undefined)).toBeNull()
    // Resposta estranha (proxy, erro em HTML, campo trocado) tambem cala.
    expect(sinalDaResposta({ positivo: 'sim' })).toBeNull()
    expect(sinalDaResposta({ positivo: 1 })).toBeNull()
  })

  it('quantidade quebrada nao vira NaN na tela', () => {
    expect(sinalDaResposta({ positivo: true, quantidade: 'dois' })).toEqual({ positivo: true, quantidade: 0, tipo: 'leilao' })
  })
})

describe('frase que vai pra tela', () => {
  const carro = 'este carro'

  it('com registro, frase VAGA: indica sem contagem, aponta pro completo', () => {
    expect(fraseSinalNaTela({ positivo: true, quantidade: 1 }, carro))
      .toBe('Existem indícios de leilão deste veículo em nossa base. Confira no relatório completo.')
    // sem contagem (nem 1 registro nem N registros)
    expect(fraseSinalNaTela({ positivo: true, quantidade: 3 }, 'esta moto')).not.toMatch(/\d+\s*registro/)
  })

  // Decisao de produto, e ja mudou duas vezes: sem registro a tela NAO fala de
  // leilao. Contar que nao achamos nada entregava de graca a duvida que vende o
  // relatorio, e ela existe em quase toda placa.
  it('sem registro, nao ha frase', () => {
    expect(fraseSinalNaTela({ positivo: false, quantidade: 0 }, carro)).toBe('')
  })

  it('quando nao da pra consultar, tambem nao ha frase', () => {
    expect(fraseSinalNaTela(null, carro)).toBe('')
  })

  it('nao vaza detalhe nenhum: so a contagem', () => {
    const f = fraseSinalNaTela({ positivo: true, quantidade: 2 }, carro).toLowerCase()
    for (const proibido of ['r$', 'sucata', 'recuper', 'lote', '2023', 'detran']) {
      expect(f, proibido).not.toContain(proibido)
    }
  })

  it('sem travessao', () => {
    expect(fraseSinalNaTela({ positivo: true, quantidade: 2 }, carro)).not.toContain('—')
  })

  it('so notificacao chega como tipo notificacao; tipo estranho vira leilao', () => {
    expect(sinalDaResposta({ positivo: true, quantidade: 1, tipo: 'notificacao' })?.tipo).toBe('notificacao')
    expect(sinalDaResposta({ positivo: true, quantidade: 1, tipo: 'x' })?.tipo).toBe('leilao')
  })
})
