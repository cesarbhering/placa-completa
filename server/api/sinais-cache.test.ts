import { describe, it, expect, afterEach, vi } from 'vitest'
import { montarSinais, HISTORICO_POSITIVO, HISTORICO_VAZIO, RECALL_POSITIVO, RECALL_VAZIO } from '../../tests/helpers/sinais-harness'

// The signal of a plate is cached for 24 h and answered to everyone who asks
// for that plate. What goes into the calculation therefore comes from what the
// SERVER holds for the plate (placa_cache, written by the free lookup); the
// body only fills what the server does not have, and a result computed with
// any body field is not cached.
const PLACA = 'TST1A23'
const DO_SERVIDOR = {
  MARCA: 'TOYOTA', MODELO: 'COROLLA XEI', ano: '2019', anoModelo: '2020', cor: 'Prata', uf: 'SP',
  chassi: '*****12345', extra: { ano_fabricacao: '2019', ano_modelo: '2020' },
}
const CORPO_CERTO = { placa: PLACA, marca: 'TOYOTA', modelo: 'COROLLA XEI', ano: '2020', anoFab: '2019', anoModelo: '2020', cor: 'Prata', uf: 'SP' }
const CORPO_ERRADO = { placa: PLACA, marca: 'OUTRA', modelo: 'OUTRO MODELO', ano: '1999', anoFab: '1998', anoModelo: '1999', cor: 'Rosa', uf: 'AC' }

afterEach(() => { vi.unstubAllGlobals() })

describe('auction signal: what is cached for a plate', () => {
  // The base only finds the record with the real attributes of the vehicle.
  const historico = (perfil: any) => (perfil.marca === 'TOYOTA' && perfil.cor === 'Prata' ? HISTORICO_POSITIVO : HISTORICO_VAZIO)

  it('a first caller with other attributes does not decide what the next callers see', async () => {
    const h = await montarSinais({ historico })
    h.guardarPlaca(PLACA, DO_SERVIDOR)
    await h.leilao(CORPO_ERRADO, { ip: '198.51.100.1' })
    expect(await h.leilao(CORPO_CERTO, { ip: '198.51.100.2' })).toMatchObject({ positivo: true, quantidade: 1 })
  })

  it('the base receives the attributes the server holds, not the ones in the body', async () => {
    const h = await montarSinais({ historico })
    h.guardarPlaca(PLACA, DO_SERVIDOR)
    expect(await h.leilao(CORPO_ERRADO)).toMatchObject({ positivo: true })
    expect(h.estado.leilao[0]).toMatchObject({
      placa: PLACA, chassi: '*****12345', marca: 'TOYOTA', modelo: 'COROLLA XEI', ano: '2020', ano_fab: '2019', ano_mod: '2020', cor: 'Prata', uf: 'SP',
    })
  })

  it('a result computed from the server data is cached by plate, as before', async () => {
    const h = await montarSinais({ historico })
    h.guardarPlaca(PLACA, DO_SERVIDOR)
    await h.leilao(CORPO_CERTO, { ip: '198.51.100.1' })
    await h.leilao(CORPO_CERTO, { ip: '198.51.100.2' })
    await h.leilao({ placa: PLACA }, { ip: '198.51.100.3' })
    expect(h.estado.leilao).toHaveLength(1)
  })

  it('plate the server does not hold: the body is used, and the result is answered to that caller only', async () => {
    const h = await montarSinais({ historico })
    expect(await h.leilao(CORPO_ERRADO, { ip: '198.51.100.1' })).toEqual({ positivo: false, quantidade: 0 })
    expect(await h.leilao(CORPO_CERTO, { ip: '198.51.100.2' })).toMatchObject({ positivo: true })
    expect(h.estado.leilao).toHaveLength(2)
    expect(h.estado.leilao[1]).toMatchObject({ marca: 'TOYOTA', cor: 'Prata', uf: 'SP', ano: '2020' })
  })

  it('a field missing on the server is filled from the body, and then nothing is cached', async () => {
    const h = await montarSinais({ historico })
    const { cor: _cor, ...semCor } = DO_SERVIDOR
    h.guardarPlaca(PLACA, semCor)
    await h.leilao({ ...CORPO_ERRADO }, { ip: '198.51.100.1' })
    expect(h.estado.leilao[0]).toMatchObject({ marca: 'TOYOTA', cor: 'Rosa' })
    expect(await h.leilao(CORPO_CERTO, { ip: '198.51.100.2' })).toMatchObject({ positivo: true })
    expect(h.estado.leilao).toHaveLength(2)
  })

  it('body attributes are bounded and typed before they go to the base', async () => {
    const h = await montarSinais({ historico: () => HISTORICO_VAZIO })
    await h.leilao({
      placa: PLACA, marca: 'M'.repeat(5000), modelo: `  modelo\n\tcom   espacos ${'x'.repeat(5000)}`, cor: 'C'.repeat(5000),
      uf: 'XX<b>', ano: { $gt: '' }, anoFab: '20199', anoModelo: ['2020'],
    })
    const p = h.estado.leilao[0]
    expect(p.marca).toHaveLength(60)
    expect(p.modelo.length).toBeLessThanOrEqual(120)
    expect(p.modelo.startsWith('modelo com espacos x')).toBe(true)
    expect(p.cor).toHaveLength(40)
    expect(p.uf).toBeNull()
    expect([p.ano, p.ano_fab, p.ano_mod]).toEqual([null, null, null])
  })

  it('a valid UF and year in the body pass through, normalised', async () => {
    const h = await montarSinais({ historico: () => HISTORICO_VAZIO })
    await h.leilao({ placa: PLACA, marca: ' Marca ', uf: ' sp ', ano: 2020, anoFab: ' 2019 ', anoModelo: '2020' })
    expect(h.estado.leilao[0]).toMatchObject({ marca: 'Marca', uf: 'SP', ano: '2020', ano_fab: '2019', ano_mod: '2020' })
  })

  it('nothing is cached when the base did not answer', async () => {
    let fora = true
    const h = await montarSinais({ historico: () => (fora ? null : HISTORICO_POSITIVO) })
    h.guardarPlaca(PLACA, DO_SERVIDOR)
    expect(await h.leilao(CORPO_CERTO)).toEqual({ positivo: null, quantidade: 0 })
    fora = false
    expect(await h.leilao(CORPO_CERTO)).toMatchObject({ positivo: true })
  })
})

describe('recall signal: what is cached for a plate', () => {
  // The base only matches the real model of the vehicle.
  const recall = (perfil: any) => (perfil.modelo === 'COROLLA XEI' ? RECALL_POSITIVO : RECALL_VAZIO)

  it('a first caller with another model does not decide what the next callers see', async () => {
    const h = await montarSinais({ recall })
    h.guardarPlaca(PLACA, DO_SERVIDOR)
    await h.recall({ ...CORPO_CERTO, modelo: 'HILUX', ano: '1999', anoFab: '1998', anoModelo: '1999' }, { ip: '198.51.100.1' })
    expect(await h.recall(CORPO_CERTO, { ip: '198.51.100.2' })).toEqual({ consta: true, nivel: 'suave' })
    expect(h.estado.recall[0]).toMatchObject({ placa: PLACA, marca: 'TOYOTA', modelo: 'COROLLA XEI', ano: '2020', ano_fab: '2019', ano_mod: '2020' })
    // Computed once from the server data, then served from the cache.
    expect(h.estado.recall).toHaveLength(1)
  })

  it('the brand the server holds wins over the one in the body', async () => {
    const h = await montarSinais({ recall })
    h.guardarPlaca(PLACA, { ...DO_SERVIDOR, MARCA: 'MARCAFORA', MODELO: 'MODELO FORA' })
    // Brand out of scope on the server: no lookup, whatever the body says.
    expect(await h.recall(CORPO_CERTO)).toEqual({ consta: null, nivel: null })
    expect(h.estado.recall).toHaveLength(0)
  })

  it('plate the server does not hold: the body is used, and the result is answered to that caller only', async () => {
    const h = await montarSinais({ recall })
    expect(await h.recall({ ...CORPO_CERTO, modelo: 'HILUX' }, { ip: '198.51.100.1' })).toEqual({ consta: false, nivel: null })
    expect(await h.recall(CORPO_CERTO, { ip: '198.51.100.2' })).toEqual({ consta: true, nivel: 'suave' })
    expect(h.estado.recall).toHaveLength(2)
  })

  it('body attributes are bounded before they go to the base', async () => {
    const h = await montarSinais({ recall: () => RECALL_VAZIO })
    await h.recall({ placa: PLACA, marca: `TOYOTA ${'M'.repeat(5000)}`, modelo: 'X'.repeat(5000), ano: { a: 1 }, anoFab: 'abcd', anoModelo: '2020' })
    const p = h.estado.recall[0]
    expect(p.marca.length).toBeLessThanOrEqual(60)
    expect(p.modelo.length).toBeLessThanOrEqual(120)
    expect([p.ano, p.ano_fab, p.ano_mod]).toEqual([null, null, '2020'])
  })

  it('a brand out of scope in the body still short-circuits before any read', async () => {
    const h = await montarSinais({ recall })
    let leituras = 0
    const original = h.sb.from
    h.sb.from = ((t: string) => { leituras++; return original(t) }) as any
    expect(await h.recall({ placa: PLACA, marca: 'MARCAFORA' })).toEqual({ consta: null, nivel: null })
    expect(leituras).toBe(0)
  })
})
