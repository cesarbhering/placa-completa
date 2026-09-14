import { describe, it, expect, vi } from 'vitest'
import { ehErroDeRede, comRetryDeRede } from './erro-de-rede'

// Incidente 14/set: "fetch failed" no consentimento virou estorno de um pedido
// pago. Esta e a regra que decide o que merece outra tentativa.
describe('o que conta como falha de rede', () => {
  it('erros de transporte que ja vimos em producao', () => {
    expect(ehErroDeRede(new TypeError('fetch failed'))).toBe(true)
    expect(ehErroDeRede({ message: 'read ECONNRESET' })).toBe(true)
    expect(ehErroDeRede({ code: 'ETIMEDOUT' })).toBe(true)
    expect(ehErroDeRede({ cause: { code: 'EAI_AGAIN' } })).toBe(true)
    expect(ehErroDeRede({ message: 'socket hang up' })).toBe(true)
  })

  it('gateway sem resposta conta como transporte', () => {
    for (const status of [502, 503, 504]) {
      expect(ehErroDeRede({ statusCode: status }), String(status)).toBe(true)
    }
  })

  // O ponto que evita estrago: 4xx e a outra ponta dizendo nao. Repetir um 401
  // nao muda nada e pode virar bloqueio de chave.
  it('resposta de negocio NAO e pra repetir', () => {
    expect(ehErroDeRede({ statusCode: 401 })).toBe(false)
    expect(ehErroDeRede({ statusCode: 400, message: 'placa invalida' })).toBe(false)
    expect(ehErroDeRede({ statusCode: 495, message: 'certificado' })).toBe(false)
    expect(ehErroDeRede({ statusCode: 422 })).toBe(false)
  })

  it('nada e erro nenhum nao viram retry', () => {
    expect(ehErroDeRede(null)).toBe(false)
    expect(ehErroDeRede(undefined)).toBe(false)
    expect(ehErroDeRede({ message: 'placa nao encontrada' })).toBe(false)
  })
})

describe('retry so em falha de rede', () => {
  it('acerta na segunda tentativa', async () => {
    let n = 0
    const r = await comRetryDeRede(async () => {
      n += 1
      if (n === 1) throw new TypeError('fetch failed')
      return 'ok'
    }, { pausas: [1, 1, 1] })
    expect(r).toBe('ok')
    expect(n).toBe(2)
  })

  it('desiste depois do teto, e propaga o erro original', async () => {
    let n = 0
    await expect(comRetryDeRede(async () => {
      n += 1
      throw new TypeError('fetch failed')
    }, { tentativas: 3, pausas: [1, 1, 1] })).rejects.toThrow('fetch failed')
    expect(n).toBe(3)
  })

  it('erro de negocio nao e repetido nem uma vez', async () => {
    let n = 0
    await expect(comRetryDeRede(async () => {
      n += 1
      throw { statusCode: 401, message: 'chave invalida' }
    }, { pausas: [1, 1, 1] })).rejects.toBeTruthy()
    expect(n).toBe(1)
  })

  it('sucesso de primeira nao espera nada', async () => {
    const t0 = Date.now()
    expect(await comRetryDeRede(async () => 'ok')).toBe('ok')
    expect(Date.now() - t0).toBeLessThan(200)
  })
})
