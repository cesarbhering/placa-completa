import { describe, it, expect } from 'vitest'
import { destinoRedirect } from './redirects-antigos'

const PEDIDOS: [string, string][] = [
  ['/audi-q5', '/tabela-fipe/audi-q5'], ['/fiat-toro', '/tabela-fipe/fiat-toro'], ['/fiat-siena', '/tabela-fipe/fiat-siena'],
  ['/tabela-fiat-siena', '/tabela-fipe/fiat-siena'], ['/tabela-fiorino', '/tabela-fipe/fiat-fiorino'], ['/honda-cr-v', '/tabela-fipe/honda-cr-v'],
  ['/jeep-renegade', '/tabela-fipe/jeep-renegade'], ['/volkswagen-gol', '/tabela-fipe/volkswagen-gol'], ['/volkswagen-t-cross', '/tabela-fipe/volkswagen-t-cross'],
  ['/toyota-hilux', '/tabela-fipe/toyota-hilux'], ['/tabela-fipe-honda-motos-nxr-160-bros', '/tabela-fipe/honda-motos-nxr-160-bros'],
  ['/tabela-fipe-honda-xre-300', '/tabela-fipe/honda-motos-xre-300'], ['/tabela-fipe/chevrolet/onix-plus', '/tabela-fipe/chevrolet-onix-plus'],
  ['/tabela-fipe/honda/civic', '/tabela-fipe/honda-civic'], ['/tabela-fipe/mitsubishi/pajero-sport', '/tabela-fipe/mitsubishi-pajero-sport'],
  ['/tabela-fipe/motos/honda-motos-biz', '/tabela-fipe/honda-motos-biz'], ['/consultar-bahia', '/consultar-placa/bahia'],
  ['/consultar-parana', '/consultar-placa/parana'], ['/consultar-rio-de-janeiro', '/consultar-placa/rio-de-janeiro'],
  ['/consultar-mato-grosso-do-sul', '/consultar-placa/mato-grosso-do-sul'], ['/consultar-salvador', '/consultar-placa/capital/salvador'],
  ['/consultar-onibus', '/consultar-placa-de-onibus'], ['/consultar-onibus-gratis-dados-completos-por-e-mail', '/consultar-placa-de-onibus'],
  ['/consultar-placacompleta.com.br/consultar-placa-de-onibus', '/consultar-placa-de-onibus'], ['/consultar-pelo-celular', '/'], ['/pt-br', '/'],
]

describe('301 dos enderecos antigos', () => {
  for (const [de, para] of PEDIDOS) it(`${de} -> ${para}`, () => expect(destinoRedirect(de)).toBe(para))
  it('paginas reais e lixo nao redirecionam', () => {
    for (const p of ['/', '/consulta-placa', '/tabela-fipe', '/tabela-fipe/fiat-toro', '/consultar-placa/bahia', '/premium/abc', '/api/consulta', '/marca-que-nao-existe', '/tabela-fipe/foo/bar'])
      expect(destinoRedirect(p), p).toBeNull()
  })
  it('barra final e maiusculas', () => {
    expect(destinoRedirect('/Audi-Q5/')).toBe('/tabela-fipe/audi-q5')
  })
})

describe('volkswagen-tcross (slug errado do Tiguan)', () => {
  it('endereco antigo vai pro T-Cross; Tiguan tem slug proprio', async () => {
    const { destinoRedirect } = await import('./redirects-antigos')
    const { findBrandModel } = await import('../data/fipe-brands')
    expect(destinoRedirect('/tabela-fipe/volkswagen-tcross')).toBe('/tabela-fipe/volkswagen-t-cross')
    expect(findBrandModel('volkswagen-tiguan')?.model.name).toBe('Tiguan')
    expect(findBrandModel('volkswagen-t-cross')?.model.name).toBe('T-Cross')
    expect(findBrandModel('volkswagen-tcross')).toBeNull()
  })
})
