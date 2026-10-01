import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import NISSAN from './__fixtures__/recall-nissan-autoritativo.json'
import MMC from './__fixtures__/recall-mitsubishi-autoritativo.json'
import MB from './__fixtures__/recall-mercedes-autoritativo.json'
import { sanearRecallAutoritativo, consultarRecallMontadora, completarRecallMontadora, marcaMontadora, _limparCacheMontadora } from './recall-montadora'

// Fixtures no formato do /v1/recall {autoritativo:true} da leiloes-api.
// NISSAN: campanhas/datas/concessionaria de respostas REAIS da Nissan (01/out),
// com um "chassi" a mais pra provar a whitelist. MMC: SINTETICA, com
// nome/CPF/OS/placa a mais pelo mesmo motivo.

describe('sanearRecallAutoritativo', () => {
  it('Nissan: aberta primeiro, realizada com data/concessionaria (km null), excluida; sem chassi', () => {
    const b = sanearRecallAutoritativo(NISSAN.autoritativo, 'nissan')!
    expect(b).toMatchObject({ fonte: 'nissan', tem_recall_aberto: true, n_campanhas: 1 })
    expect(b.campanhas.map((c) => [c.codigo, c.status])).toEqual([['RT030', 'aberto'], ['RT038', 'realizado'], ['R1202', 'excluido']])
    expect(b.atendimentos).toEqual([{ codigo: 'RT038', titulo: 'Substituição do Gerador de Gases Do Airbag Do Motorista', data: '2021-01-15', km: null, concessionaria: 'NICENTER AV. BRASILIA NBA' }])
    expect(JSON.stringify(b)).not.toContain('9XXXXXXXXXXXXXXXX')
  })
  it('Mitsubishi: atendimentos com km; nunca nome/CPF/OS/placa', () => {
    const b = sanearRecallAutoritativo(MMC.autoritativo, 'mitsubishi')!
    expect(b).toMatchObject({ fonte: 'mitsubishi', tem_recall_aberto: true, n_campanhas: 1 })
    expect(b.atendimentos.map((a) => a.km)).toEqual([41250, 18300])
    const out = JSON.stringify(b)
    for (const p of ['FULANO', '123.456.789', 'OS-998877', 'ABC1D23', 'situacao']) expect(out).not.toContain(p)
  })
  it('Mercedes-Benz: codigo null e km null passam; nome nao', () => {
    const b = sanearRecallAutoritativo(MB.autoritativo, 'mercedes-benz')!
    expect(b).toMatchObject({ fonte: 'mercedes-benz', tem_recall_aberto: true, n_campanhas: 1 })
    expect(b.campanhas.map((c) => [c.codigo, c.status])).toEqual([['', 'aberto'], ['', 'realizado']])
    expect(b.atendimentos).toEqual([{ codigo: null, titulo: 'Inspeção da mangueira de combustível', data: '2019-05-20', km: null, concessionaria: 'CONCESSIONARIA EXEMPLO' }])
    expect(JSON.stringify(b)).not.toContain('FULANO')
  })
  it('situacao "nada_consta" (sem campanha): consultado, listas vazias, sem recall aberto (o card do SENATRAN segue)', () => {
    const b = sanearRecallAutoritativo({ fonte: 'mercedes-benz', consultado: true, situacao: 'nada_consta', campanhas: [], atendimentos: [] }, 'mercedes-benz')!
    expect(b).toMatchObject({ consultado: true, tem_recall_aberto: false, n_campanhas: 0, campanhas: [], atendimentos: [] })
  })
  it('fonte trocada, sem consultado ou sem o campo -> null (vale o match local)', () => {
    expect(sanearRecallAutoritativo(NISSAN.autoritativo, 'mitsubishi')).toBeNull()
    expect(sanearRecallAutoritativo({ ...MMC.autoritativo, consultado: false }, 'mitsubishi')).toBeNull()
    expect(sanearRecallAutoritativo(undefined, 'nissan')).toBeNull()
  })
})

describe('consultar/completar via leiloes-api', () => {
  beforeEach(() => {
    _limparCacheMontadora()
    vi.stubGlobal('useRuntimeConfig', () => ({ leiloesApiUrl: 'http://api', leiloesApiKey: 'k', public: { gated: true } }))
  })
  afterEach(() => vi.unstubAllGlobals())
  const VIN = '3N1AB7AD1KY000000'

  it('marcaMontadora', () => {
    expect(marcaMontadora('NISSAN/KICKS')).toBe('nissan')
    expect(marcaMontadora('I/NISSAN FRONTIER')).toBe('nissan')
    expect(marcaMontadora('MMC/L200 TRITON')).toBe('mitsubishi')
    expect(marcaMontadora('MITSUBISHI/PAJERO')).toBe('mitsubishi')
    expect(marcaMontadora('M.BENZ/C180 CGI')).toBe('mercedes-benz')
    expect(marcaMontadora('I/M.BENZ GLA200')).toBe('mercedes-benz')
    expect(marcaMontadora('MERCEDES-BENZ/A200')).toBe('mercedes-benz')
    expect(marcaMontadora('MBENZ/SPRINTER')).toBe('mercedes-benz')
    expect(marcaMontadora('RENAULT/KWID')).toBeNull()
  })
  it('Nissan vai pela leiloes-api (marca NISSAN), sem GET direto na Nissan; timeout 40s', async () => {
    const f = vi.fn(async () => NISSAN); vi.stubGlobal('$fetch', f)
    const g = vi.fn(); vi.stubGlobal('fetch', g)
    const b = await consultarRecallMontadora('nissan', VIN, { modelo: 'NISSAN/FRONTIER', ano_fab: 2008, ano_mod: 2008 })
    expect(b?.fonte).toBe('nissan')
    const [url, opts]: any = f.mock.calls[0]
    expect(url).toBe('http://api/v1/recall')
    expect(opts.body).toMatchObject({ chassi: VIN, marca: 'NISSAN', ano_fab: '2008', autoritativo: true })
    expect(opts.timeout).toBe(40000)
    expect(g).not.toHaveBeenCalled()
  })
  it('Mitsubishi: marca MMC, anos string', async () => {
    const f = vi.fn(async () => MMC); vi.stubGlobal('$fetch', f)
    await consultarRecallMontadora('mitsubishi', 'JMYLYV98WGJ000000', { modelo: 'MMC/OUTLANDER', ano_fab: 2015, ano_mod: 2016 })
    expect((f.mock.calls[0] as any)[1].body).toMatchObject({ marca: 'MMC', ano_fab: '2015', ano_mod: '2016', autoritativo: true })
  })
  it('Mercedes: marca M.BENZ no /v1/recall', async () => {
    const f = vi.fn(async () => MB); vi.stubGlobal('$fetch', f)
    const b = await consultarRecallMontadora('mercedes-benz', 'WDDHF8JB0FA000000', { modelo: 'M.BENZ/C180' })
    expect((f.mock.calls[0] as any)[1].body).toMatchObject({ marca: 'M.BENZ', autoritativo: true })
    expect(b?.fonte).toBe('mercedes-benz')
  })
  it('sem o campo autoritativo: 1 retry e acerta', async () => {
    const f = vi.fn().mockResolvedValueOnce({ matches: [] }).mockResolvedValueOnce(MMC)
    vi.stubGlobal('$fetch', f)
    const b = await consultarRecallMontadora('mitsubishi', 'JMYLYV98WGJ000000', {}, { retryMs: 1 })
    expect(f).toHaveBeenCalledTimes(2)
    expect(b?.n_campanhas).toBe(1)
  })
  it('erro/sem campo nas duas: null depois de exatamente 2 chamadas, sem cache', async () => {
    const f = vi.fn(async () => { throw new Error('timeout') }); vi.stubGlobal('$fetch', f)
    expect(await consultarRecallMontadora('nissan', VIN, {}, { retryMs: 1 })).toBeNull()
    expect(f).toHaveBeenCalledTimes(2)
    const g = vi.fn(async () => NISSAN); vi.stubGlobal('$fetch', g)
    expect(await consultarRecallMontadora('nissan', VIN, {}, { retryMs: 1 })).not.toBeNull()
  })
  it('1a ja esperou a montadora (>= 10s): NAO repete', async () => {
    let t = 0
    const f = vi.fn(async () => { t += 31000; return { matches: [] } }); vi.stubGlobal('$fetch', f)
    expect(await consultarRecallMontadora('mitsubishi', 'JMYLYV98WGJ000000', {}, { retryMs: 1, agora: () => t })).toBeNull()
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('cache por chassi: a segunda consulta nao chama', async () => {
    const f = vi.fn(async () => NISSAN); vi.stubGlobal('$fetch', f)
    await consultarRecallMontadora('nissan', VIN)
    await consultarRecallMontadora('nissan', VIN.toLowerCase())
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('todo Nissan com chassi cheio, MESMO sem flag: grava recallMontadora sem pisar no resto', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => NISSAN))
    const updates: any[] = []
    const sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {}, recall: { status: 'ok' } } } }) }) }), update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }) }) }
    const r = await completarRecallMontadora(sb, { id: 'p1' }, [{ descricaoMarcaModelo: 'NISSAN/FRONTIER', chassi: VIN, indicadorRecall: false }])
    expect(r).toEqual({ ok: true, abertas: 1 })
    expect(updates[0].relatorio_snapshot.recall).toEqual({ status: 'ok' })
    expect(updates[0].relatorio_snapshot.recallMontadora.fonte).toBe('nissan')
  })
  it('outra marca ou sem chassi: nao chama', async () => {
    const f = vi.fn(); vi.stubGlobal('$fetch', f)
    const sb: any = {}
    expect(await completarRecallMontadora(sb, { id: 'p1' }, [{ descricaoMarcaModelo: 'RENAULT/KWID', chassi: VIN }])).toMatchObject({ pulado: 'marca sem consulta da montadora' })
    expect(await completarRecallMontadora(sb, { id: 'p1' }, [{ descricaoMarcaModelo: 'MMC/ASX', chassi: '' }])).toMatchObject({ pulado: 'sem chassi cheio' })
    expect(f).not.toHaveBeenCalled()
  })
})
