import { describe, it, expect, vi } from 'vitest'
import {
  provedorNfse,
  descricaoDaNota,
  ErroNfseIndisponivel,
  ErroNfseRejeitado,
} from './nfse-provedor'

const CONFIG = { nfseUrl: 'https://emissor.example.test', nfseApiKey: 'chave-de-teste' }

describe('provedorNfse', () => {
  it('emitir envia Bearer, corpo e opcoes de timeout', async () => {
    const f = vi.fn().mockResolvedValue({ id: 'n1', estado: 'pendente' })
    const r = await provedorNfse(CONFIG, f as any).emitir({
      referencia: 'ref-1',
      valorCentavos: 1990,
      competencia: '2026-11-12',
      descricao: 'desc',
      tomador: { documento: '12345678909', nome: 'Fulano de Teste' },
      email: 'a@example.test',
      metadados: { k: 'v' },
    })
    expect(r).toEqual({ id: 'n1', estado: 'pendente' })
    const [url, opts] = f.mock.calls[0]
    expect(url).toBe('https://emissor.example.test/v1/notas')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer chave-de-teste')
    expect(opts.timeout).toBe(3000)
    expect(opts.retry).toBe(0)
    expect(opts.body).toEqual({
      referencia: 'ref-1',
      valor_centavos: 1990,
      competencia: '2026-11-12',
      descricao: 'desc',
      tomador: { documento: '12345678909', nome: 'Fulano de Teste' },
      email: 'a@example.test',
      metadados: { k: 'v' },
    })
  })

  it('emitir omite tomador, email e metadados quando ausentes', async () => {
    const f = vi.fn().mockResolvedValue({ id: 'n1', estado: 'aguardando_tomador' })
    await provedorNfse(CONFIG, f as any).emitir({
      referencia: 'r', valorCentavos: 100, competencia: '2026-11-12', descricao: 'd',
    })
    expect(Object.keys(f.mock.calls[0][1].body).sort()).toEqual(
      ['competencia', 'descricao', 'referencia', 'valor_centavos'],
    )
  })

  it('503 vira ErroNfseIndisponivel', async () => {
    const f = vi.fn().mockRejectedValue({ statusCode: 503, data: { erro: 'x' } })
    await expect(provedorNfse(CONFIG, f as any).consultar('n1')).rejects.toBeInstanceOf(ErroNfseIndisponivel)
  })

  it('429, timeout e erro de rede viram ErroNfseIndisponivel', async () => {
    for (const e of [{ statusCode: 429 }, { name: 'TimeoutError' }, new TypeError('fetch failed')]) {
      const f = vi.fn().mockRejectedValue(e)
      await expect(provedorNfse(CONFIG, f as any).consultar('n1')).rejects.toBeInstanceOf(ErroNfseIndisponivel)
    }
  })

  it('422 vira ErroNfseRejeitado com status e body', async () => {
    const data = { erro: 'corpo_invalido', campos: ['tomador.nome'] }
    const f = vi.fn().mockRejectedValue({ statusCode: 422, data })
    const err = await provedorNfse(CONFIG, f as any)
      .emitir({ referencia: 'r', valorCentavos: 1, competencia: '2026-11-12', descricao: 'd' })
      .catch((e) => e)
    expect(err).toBeInstanceOf(ErroNfseRejeitado)
    expect(err.status).toBe(422)
    expect(err.body).toEqual(data)
  })

  it('401, 403, 404 e 405 viram ErroNfseIndisponivel', async () => {
    for (const statusCode of [401, 403, 404, 405]) {
      const f = vi.fn().mockRejectedValue({ statusCode, data: { erro: 'x' } })
      await expect(provedorNfse(CONFIG, f as any).consultar('n1')).rejects.toBeInstanceOf(ErroNfseIndisponivel)
    }
  })

  it('409 e 400 viram ErroNfseRejeitado com status', async () => {
    for (const statusCode of [409, 400]) {
      const f = vi.fn().mockRejectedValue({ statusCode, data: { erro: 'x' } })
      const err = await provedorNfse(CONFIG, f as any).consultar('n1').catch((e) => e)
      expect(err).toBeInstanceOf(ErroNfseRejeitado)
      expect(err.status).toBe(statusCode)
    }
  })

  it('consultar faz GET com Bearer', async () => {
    const nota = { id: 'n1', referencia: 'r', estado: 'emitida', numero: '5' }
    const f = vi.fn().mockResolvedValue(nota)
    expect(await provedorNfse(CONFIG, f as any).consultar('n1')).toEqual(nota)
    expect(f.mock.calls[0][0]).toBe('https://emissor.example.test/v1/notas/n1')
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer chave-de-teste')
  })

  it('cancelar faz POST com motivo', async () => {
    const f = vi.fn().mockResolvedValue({})
    await provedorNfse(CONFIG, f as any).cancelar('n1', 'reembolso')
    expect(f.mock.calls[0][0]).toBe('https://emissor.example.test/v1/notas/n1/cancelar')
    expect(f.mock.calls[0][1].method).toBe('POST')
    expect(f.mock.calls[0][1].body).toEqual({ motivo: 'reembolso' })
  })

  it('pdf devolve Buffer', async () => {
    const f = vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70]).buffer)
    const b = await provedorNfse(CONFIG, f as any).pdf('n1')
    expect(Buffer.isBuffer(b)).toBe(true)
    expect(b.toString()).toBe('%PDF')
    expect(f.mock.calls[0][1].responseType).toBe('arrayBuffer')
    expect(f.mock.calls[0][1].timeout).toBe(15000)
  })
})

describe('descricaoDaNota', () => {
  it('completa', () => {
    expect(descricaoDaNota({ plano: 'completa', placa: 'ABC1D23', pedidoId: '12345678-aaaa-bbbb-cccc-000000000000' }))
      .toBe('Consulta veicular por placa: relatório Completo com dados cadastrais, débitos, restrições e histórico de leilão do veículo de placa ABC1D23. Pedido 12345678.')
  })
  it('basica', () => {
    expect(descricaoDaNota({ plano: 'basica', placa: 'ABC1D23', pedidoId: '12345678-x' }))
      .toContain('relatório Básico com')
  })
})
