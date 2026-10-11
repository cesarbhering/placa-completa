import { describe, it, expect, vi, afterEach } from 'vitest'
import GO from './__fixtures__/infosimples-detran-go.json'
import { completarDetran, placaParaDetran, detalheDaRecusa, semDadoPessoal, registrarCusto } from './infosimples-detran'

// Casos CDR2189 (08/out) e BVV4005 (10/out): DETRAN-SP devolveu 608
// "parametros recusados" e nao ficou rastro de qual parametro.
const cfg = () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' })
function fakeSb(opts: { semColunaDetalhe?: boolean } = {}) {
  const inserts: any[] = []; const updates: any[] = []
  return {
    inserts, updates,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {} } } }) }) }),
      insert: async (row: any) => {
        if (opts.semColunaDetalhe && 'detalhe' in row) return { error: { message: 'column "detalhe" does not exist' } }
        inserts.push(row); return { error: null }
      },
      update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
    }),
  }
}

describe('placa que vai pro DETRAN', () => {
  it('usa a placa atual do registro quando diverge da do pedido (CDR2189 -> CDR2B89)', () => {
    expect(placaParaDetran('CDR2189', [{ placa: 'CDR2B89' }])).toBe('CDR2B89')
    expect(placaParaDetran('cdr-2189', { placa: 'cdr2b89' })).toBe('CDR2B89')
  })
  it('sem placa valida no registro, fica a do pedido', () => {
    expect(placaParaDetran('BVV4005', [{ placa: 'BVV4005' }])).toBe('BVV4005')
    expect(placaParaDetran('BVV4005', [{}])).toBe('BVV4005')
    expect(placaParaDetran('BVV4005', [{ placa: '***' }])).toBe('BVV4005')
    expect(placaParaDetran('BVV4005', null)).toBe('BVV4005')
  })
})

describe('motivo da recusa', () => {
  it('junta code_message e errors, sem placa/renavam/CPF/e-mail', () => {
    const d = detalheDaRecusa({
      code: 608,
      codeMessage: 'Os parâmetros foram recusados pelo site de origem.',
      erros: ['Renavam 00426889657 não confere com a placa BVV4005.', 'CPF 123.456.789-09 / fulano@x.com.br', 'Chassi 9C2KD0810LR123456'],
    })!
    expect(d).toContain('recusados pelo site de origem')
    expect(d).toContain('Renavam <num> não confere com a placa <placa>')
    expect(d).not.toMatch(/00426889657|BVV4005|123\.456|fulano|9C2KD/)
  })
  it('200 nao tem motivo; repetido sai uma vez', () => {
    expect(detalheDaRecusa({ code: 200, codeMessage: 'ok', erros: [] })).toBeNull()
    expect(detalheDaRecusa({ code: 609, codeMessage: 'x', erros: ['x'] })).toBe('x')
  })
  it('placa Mercosul com hifen tambem sai', () => {
    expect(semDadoPessoal('placa ABC-1D23')).toBe('placa <placa>')
  })
})

describe('completarDetran com recusa', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('manda a placa do registro e grava o motivo no custo e no log', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    const corpos: URLSearchParams[] = []
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => {
      corpos.push(init.body)
      return { status: 200, json: async () => ({ code: 608, code_message: 'Os parâmetros foram recusados pelo site de origem.', errors: ['Placa CDR2189 inválida.'], header: { price: '0.28' } }) }
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = fakeSb()
    const resp = [{ ufJurisdicao: 'SP', placa: 'CDR2B89', renavam: '1214281084', indicadorMultaRenainf: true }]
    const r = await completarDetran(sb, { id: 'abcdef12-0000', placa: 'CDR2189' }, { response: resp, esperaRetryMs: 0, ignorarGate: true })
    expect(r).toMatchObject({ ok: false, code: 608 })
    expect(corpos[0].get('placa')).toBe('CDR2B89')
    expect(sb.inserts[0]).toMatchObject({ code: 608, detalhe: 'Os parâmetros foram recusados pelo site de origem. | Placa <placa> inválida.' })
    const linha = warn.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith('[detran] indisponivel'))!
    expect(linha).toContain('code=608')
    expect(linha).toContain('Placa <placa> inválida')
    expect(linha).not.toMatch(/CDR2/)
  })

  it('200 nao grava detalhe', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [GO] }) })))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = fakeSb()
    await completarDetran(sb, { id: 'abcdef12-0000', placa: 'NLR8389' }, { response: [{ ufJurisdicao: 'GO', renavam: '341284556', indicadorMultaRenainf: true }], esperaRetryMs: 0 })
    expect(sb.inserts[0]).not.toHaveProperty('detalhe')
  })

  it('banco sem a coluna detalhe: o custo e gravado mesmo assim', async () => {
    const sb = fakeSb({ semColunaDetalhe: true })
    await registrarCusto(sb, { pedidoId: 'p', fonte: 'infosimples_detran_sp', preco: 0.28, code: 608, detalhe: 'x' })
    expect(sb.inserts).toEqual([{ pedido_id: 'p', fonte: 'infosimples_detran_sp', preco: 0.28, code: 608 }])
  })
})
