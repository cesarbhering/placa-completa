import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import NISSAN from './__fixtures__/recall-nissan.json'
import MMC from './__fixtures__/recall-mitsubishi-autoritativo.json'
import {
  parsearRecallNissan, sanearRecallMitsubishi, consultarRecallMontadora, completarRecallMontadora,
  marcaMontadora, _limparCacheMontadora,
} from './recall-montadora'

// NISSAN = respostas REAIS da consulta oficial (01/out, chassi trocado por
// FALSO): Frontier com 3 campanhas realizadas (RT030 com 2 itens) e um carro com
// RT030 pendente. MMC = fixture SINTETICA no formato combinado com a leiloes-api
// (o endpoint so entra no redeploy), com nome/CPF/OS/placa pra provar a whitelist.

describe('parsearRecallNissan (formato unico)', () => {
  it('3 realizadas: campanhas + 1 atendimento por campanha (data, concessionaria, sem km)', () => {
    const b = parsearRecallNissan(NISSAN.realizadas)!
    expect(b).toMatchObject({ fonte: 'nissan', consultado: true, tem_recall_aberto: false, n_campanhas: 0 })
    expect(b.campanhas.map((c) => [c.codigo, c.status])).toEqual([['RT038', 'realizado'], ['RT030', 'realizado'], ['R1202', 'realizado']])
    expect(b.atendimentos[0]).toEqual({ codigo: 'RT038', titulo: 'Substituição do Gerador de Gases Do Airbag Do Motorista', data: '2021-01-15', km: null, concessionaria: 'NICENTER AV. BRASILIA NBA' })
    expect(b.atendimentos.find((a) => a.codigo === 'RT030')).toMatchObject({ data: '2019-01-04', concessionaria: 'NICENTER APUCARANA NBA' })
    const out = JSON.stringify(b)
    for (const p of ['9XXXXXXXXXXXXXXXX', 'chassis', 'texto_da_campanha', '98510EB79C', 'itens_do_reparo']) expect(out).not.toContain(p)
  })
  it('pendente vira aberto, sem atendimento', () => {
    const b = parsearRecallNissan(NISSAN.pendente)!
    expect(b).toMatchObject({ tem_recall_aberto: true, n_campanhas: 1, atendimentos: [] })
    expect(b.campanhas[0]).toMatchObject({ codigo: 'RT030', status: 'aberto' })
  })
  it('qualquer item nao reparado deixa a campanha aberta; abertas primeiro', () => {
    const b = parsearRecallNissan([...NISSAN.realizadas, { ...NISSAN.realizadas[1], efetuou_o_reparo: false, data_do_reparo: null }])!
    expect(b.campanhas[0]).toMatchObject({ codigo: 'RT030', status: 'aberto' })
    expect(b.n_campanhas).toBe(1)
  })
  it('excluido; lista vazia; nao-lista', () => {
    expect(parsearRecallNissan([{ ...NISSAN.pendente[0], excluido_do_recall: true }])!.campanhas[0].status).toBe('excluido')
    expect(parsearRecallNissan([])).toMatchObject({ campanhas: [], atendimentos: [], tem_recall_aberto: false })
    expect(parsearRecallNissan({ erro: 1 })).toBeNull()
  })
})

describe('sanearRecallMitsubishi', () => {
  it('abertas e realizadas, atendimentos com km; nunca nome/CPF/OS/placa', () => {
    const b = sanearRecallMitsubishi(MMC.autoritativo)!
    expect(b).toMatchObject({ fonte: 'mitsubishi', tem_recall_aberto: true, n_campanhas: 1 })
    expect(b.campanhas.map((c) => [c.codigo, c.status])).toEqual([['MMC-2019-01', 'aberto'], ['MMC-2016-03', 'realizado'], ['MMC-2014-02', 'realizado']])
    expect(b.atendimentos).toEqual([
      { codigo: 'MMC-2016-03', titulo: 'Inspeção do cubo da roda traseira', data: '2017-03-10', km: 41250, concessionaria: 'MITSUBISHI MOTORS ALPHA SP' },
      { codigo: 'MMC-2014-02', titulo: 'Reprogramação da central do motor', data: '2015-06-02', km: 18300, concessionaria: 'MITSUBISHI BETA RJ' },
    ])
    const out = JSON.stringify(b)
    for (const p of ['FULANO', '123.456.789', 'OS-998877', 'ABC1D23', 'situacao']) expect(out).not.toContain(p)
  })
  it('sem consultado/fonte errada -> null (vale o match local)', () => {
    expect(sanearRecallMitsubishi(undefined)).toBeNull()
    expect(sanearRecallMitsubishi({ ...MMC.autoritativo, consultado: false })).toBeNull()
    expect(sanearRecallMitsubishi({ ...MMC.autoritativo, fonte: 'gm' })).toBeNull()
  })
})

describe('consultar/completar', () => {
  beforeEach(() => _limparCacheMontadora())
  afterEach(() => vi.unstubAllGlobals())
  const VIN = '3N1AB7AD1KY000000'
  function fakeSb(snap: any = { consulta: {}, recall: { status: 'ok' } }) {
    const updates: any[] = []
    return {
      updates,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
  }

  it('marcaMontadora', () => {
    expect(marcaMontadora('NISSAN/KICKS')).toBe('nissan')
    expect(marcaMontadora('I/NISSAN FRONTIER')).toBe('nissan')
    expect(marcaMontadora('MMC/L200 TRITON')).toBe('mitsubishi')
    expect(marcaMontadora('MITSUBISHI/PAJERO')).toBe('mitsubishi')
    expect(marcaMontadora('RENAULT/KWID')).toBeNull()
  })
  it('Nissan: 1 GET por chassi, com cache', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => NISSAN.pendente }))
    vi.stubGlobal('fetch', f)
    const a = await consultarRecallMontadora('nissan', VIN)
    expect(await consultarRecallMontadora('nissan', VIN.toLowerCase())).toEqual(a)
    expect(f).toHaveBeenCalledTimes(1)
    expect(String((f.mock.calls[0] as any)[0])).toMatch(/nissanRecall\/recall\/3N1AB7AD1KY000000$/)
  })
  it('Mitsubishi: POST /v1/recall com marca MMC, anos string e autoritativo:true', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ leiloesApiUrl: 'http://api', leiloesApiKey: 'k', public: { gated: true } }))
    const f = vi.fn(async () => MMC)
    vi.stubGlobal('$fetch', f)
    const b = await consultarRecallMontadora('mitsubishi', 'JMYLYV98WGJ000000', { modelo: 'MMC/OUTLANDER', ano_fab: 2015, ano_mod: 2016, placa: 'ABC1D23' })
    expect(b?.n_campanhas).toBe(1)
    const [url, opts]: any = f.mock.calls[0]
    expect(url).toBe('http://api/v1/recall')
    expect(opts.body).toMatchObject({ chassi: 'JMYLYV98WGJ000000', marca: 'MMC', ano_fab: '2015', ano_mod: '2016', autoritativo: true })
  })
  it('Mitsubishi sem o campo autoritativo (antes do redeploy): null', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ leiloesApiUrl: 'http://api', leiloesApiKey: 'k', public: {} }))
    vi.stubGlobal('$fetch', vi.fn(async () => ({ matches: [] })))
    expect(await consultarRecallMontadora('mitsubishi', 'JMYLYV98WGJ000000')).toBeNull()
  })
  it('fail-open: HTTP erro e excecao -> null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    expect(await consultarRecallMontadora('nissan', VIN)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout') }))
    expect(await consultarRecallMontadora('nissan', VIN)).toBeNull()
  })
  it('todo Nissan com chassi cheio, MESMO sem flag: grava recallMontadora sem pisar no resto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => NISSAN.realizadas })))
    const sb = fakeSb()
    const r = await completarRecallMontadora(sb, { id: 'p1' }, [{ descricaoMarcaModelo: 'NISSAN/FRONTIER', chassi: VIN, indicadorRecall: false }])
    expect(r).toEqual({ ok: true, abertas: 0 })
    expect(sb.updates[0].relatorio_snapshot.recall).toEqual({ status: 'ok' })
    expect(sb.updates[0].relatorio_snapshot.recallMontadora.fonte).toBe('nissan')
  })
  it('outra marca ou sem chassi: nao chama', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f); vi.stubGlobal('$fetch', f)
    expect(await completarRecallMontadora(fakeSb(), { id: 'p1' }, [{ descricaoMarcaModelo: 'RENAULT/KWID', chassi: VIN }])).toMatchObject({ pulado: 'marca sem consulta da montadora' })
    expect(await completarRecallMontadora(fakeSb(), { id: 'p1' }, [{ descricaoMarcaModelo: 'MMC/ASX', chassi: '' }])).toMatchObject({ pulado: 'sem chassi cheio' })
    expect(f).not.toHaveBeenCalled()
  })
})
