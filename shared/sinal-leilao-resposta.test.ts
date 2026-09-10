import { describe, it, expect } from 'vitest'
import { sinalDaResposta } from './sinal-leilao-resposta'

describe('leitura da resposta do sinal de leilao', () => {
  it('achou: vira sinal positivo com a contagem', () => {
    expect(sinalDaResposta({ positivo: true, quantidade: 2 })).toEqual({ positivo: true, quantidade: 2 })
  })

  it('base respondeu sem registro: vira sinal negativo, que PODE ir pra tela', () => {
    expect(sinalDaResposta({ positivo: false, quantidade: 0 })).toEqual({ positivo: false, quantidade: 0 })
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
    expect(sinalDaResposta({ positivo: true, quantidade: 'dois' })).toEqual({ positivo: true, quantidade: 0 })
  })
})
