// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import RN from './__fixtures__/infosimples-detran-rn.json'
import { parsearDetranRn, blocoDetranDaUf, completarDetran, DETRAN_UFS, usaLoginGovbr } from './infosimples-detran'

// Resposta REAL do DETRAN-RN (RPD2B20, 14/out) saneada: dono, agente, placa, renavam e recibo trocados.
const HOJE = new Date('2026-10-14T12:00:00-03:00')

describe('DETRAN-RN /veiculo', () => {
  it('caso real: 1 multa com o valor do debito do mesmo auto, licenciamento 2026, sem restricao', () => {
    const b: any = blocoDetranDaUf('RN', RN)
    expect(b.multas_itens).toEqual([{
      auto: 'UF:SE-127100-V 00782213-5550', descricao: 'ESTACIONAR EM LOCAIS/HORARIO PROIBIDOS C/PLACA SINALIZANDO',
      dataInfracao: '13/01/2026', horaInfracao: '07:00', dataVencimento: '08/06/2026', valor: 137.23,
      local: 'RUA SAGRADO CORACAO DE JESUS A', municipio: null, orgao: null,
    }])
    expect(b).toMatchObject({ fonte: 'detran_rn', multas_total_centavos: 13723, ipva_total_centavos: 0, licenciamento_centavos: 0, ultimo_licenciamento_ano: 2026, licenciamento_em: '2026-10-09', restricoes_detran: [] })
    expect(JSON.stringify(b)).not.toMatch(/FULANO|CICRANO|storage\.invalid|00000000000/)
  })
  it('impedimento ativo, restricao de venda, situacao, taxas', () => {
    const b: any = parsearDetranRn({ multas: [], debitos: [], valor_taxas_detran: 50, restricao: 'ALIENACAO FIDUCIARIA', situacao: 'Bloqueado',
      impedimentos: [{ impedimento: 'BLOQUEIO JUDICIAL', motivo: 'RENAJUD', situacao: 'ATIVO', outorgante: 'FULANO' }, { impedimento: 'ROUBO', situacao: 'BAIXADO' }],
      vencimento_licenciamento: '2023 em 10/05/2023' }, HOJE)
    expect(b.restricoes_detran).toEqual([
      { tipo: 'outros_debitos', texto: 'Seguro/taxas em aberto no DETRAN-RN: R$ 50,00' },
      { tipo: 'financeira', texto: 'ALIENACAO FIDUCIARIA' },
      { tipo: 'judiciaria', texto: 'BLOQUEIO JUDICIAL: RENAJUD' },
      { tipo: 'situacao', texto: 'Bloqueado' },
    ])
    expect(b.licenciamento_atrasado_ano).toBe(2023)
    expect(JSON.stringify(b)).not.toContain('FULANO')
  })
  it('mapa: login gov.br (govbr_rn), gate sempre', () => {
    expect(DETRAN_UFS.RN).toMatchObject({ path: 'detran/rn/veiculo', cert: 'govbr_rn', gate: 'sempre', fonteCusto: 'infosimples_detran_rn' })
    expect(usaLoginGovbr('govbr_rn')).toBe(true)
  })
})

describe('RN: chamada manda placa + renavam + login gov.br', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it('corpo e custo', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't' }))
    vi.stubEnv('NUXT_INFOSIMPLES_BA_CPF', '123.456.789-00')
    vi.stubEnv('NUXT_INFOSIMPLES_BA_SENHA', 's')
    const chamadas: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { chamadas.push({ url, body: init.body }); return { status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [RN] }) } }))
    const inserts: any[] = []; let snap: any = { consulta: {} }
    const sb = { from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
      insert: async (r: any) => { inserts.push(r); return { error: null } },
      update: (r: any) => ({ eq: async () => { snap = r.relatorio_snapshot; return { error: null } } }) }) }
    const r = await completarDetran(sb, { id: 'p', placa: 'RPD2B20' }, { response: [{ ufJurisdicao: 'RN', renavam: '1298852835' }] })
    expect(r.ok).toBe(true)
    expect(chamadas[0].url).toMatch(/\/detran\/rn\/veiculo$/)
    const b = chamadas[0].body
    expect(b.get('placa')).toBe('RPD2B20')
    expect(b.get('renavam')).toBe('01298852835')
    expect(b.has('login_cpf')).toBe(true)
    expect(b.has('pkcs12_cert')).toBe(false)
    expect(inserts[0]).toMatchObject({ fonte: 'infosimples_detran_rn', preco: 0.28, code: 200 })
    expect(snap.multas.multas_total_centavos).toBe(13723)
  })
})

describe('copy de SEO acompanha o mapa', () => {
  it('"N UFs" e a lista batem com DETRAN_UFS', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    // So as UFs que trazem infracoes (o RJ so traz restricoes: soRestricoes).
    const comMultas = Object.entries(DETRAN_UFS).filter(([, c]) => !(c as any).soRestricoes).map(([uf]) => uf)
    const n = comMultas.length
    const art = readFileSync(join(process.cwd(), 'shared/artigos-o-que-e.ts'), 'utf8')
    const clu = readFileSync(join(process.cwd(), 'shared/cluster-compra.ts'), 'utf8')
    // so as frases de cobertura do DETRAN ("22 UFs diferentes" e a origem dos carros consultados, outro dado)
    const cobertura = art.match(/(?:DETRAN em|registrados em) \d+ UFs/g) || []
    expect(cobertura.length).toBe(3)
    expect(cobertura.every((x) => x.endsWith(`${n} UFs`))).toBe(true)
    expect(clu).toContain(`${n} UFs`)
    const lista = art.match(/em \d+ UFs \(([^)]+)\)/)![1].replace(' e ', ', ').split(', ').sort()
    expect(lista).toEqual(comMultas.sort())
  })
})
