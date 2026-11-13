import { describe, it, expect, vi } from 'vitest'

// getValorCusto when the FIPE judge is called and returns no verdict (usage
// limit): the report keeps the shortlist as an honest doubt instead of the
// source's best score, and the buyer's choice is accepted by validarEscolha.
vi.mock('./fipe-api', () => ({ fipePriceHistory: vi.fn(async () => null) }))
vi.mock('./seguro-estimate', () => ({ getSeguroEstimado: vi.fn(async () => null) }))
const alerta = vi.fn(async () => true)
vi.mock('./alerta-haiku', () => ({ alertarFalhaHaiku: alerta }))
vi.stubGlobal('useRuntimeConfig', () => ({ placaApiToken: 'x', fipeApiUrl: 'http://fipe', fipeApiToken: 't', anthropicApiKey: 'k' }))
const d = (codigo: string, modelo: string, score: number) => ({ score, codigo_fipe: codigo, codigo_modelo: '1', texto_modelo: modelo, texto_valor: 'R$ 90.000,00', texto_marca: 'Toyota', combustivel: 'Diesel', mes_referencia: 'agosto de 2026' })
// The source's best score (SR, 80) is inside the funnel list: before, this
// became a silent 'fallback' pick and the report had no list.
vi.stubGlobal('consultarPlacaWdapi', async () => ({
  marca: 'TOYOTA', MODELO: 'HILUX CD4X4', anoModelo: '2008',
  fipe: { dados: [d('002090-7', 'Hilux CD SR D4-D 4x4 3.0  TDI Dies.', 80), d('002092-3', 'Hilux CD SRV D4-D 4x4 3.0  TDI Dies', 40)] },
}))
vi.stubGlobal('aceitaCustoDeCarro', () => true)

const { getValorCusto } = await import('./valor-custo')
const { validarEscolha } = await import('./fipe-escolha')
const { fipeEIncerta } = await import('../../shared/fipe-incerta')

describe('getValorCusto: judge without a verdict', () => {
  it('records fipeCandidato with the shortlist and the buyer choice is accepted', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/modelos')) return { ok: true, json: async () => ({ data: [] }) } as any
      if (u.includes('anthropic')) return { ok: false, status: 429, json: async () => ({ error: { type: 'rate_limit_error', message: 'limit' } }) } as any
      return { ok: false, json: async () => ({}) } as any
    }))
    const vc: any = await getValorCusto('AAA0000', 'SP', null, {
      ativo: true, segmento: 'carro',
      senatran: { cilindrada: 2982, potencia: 163, descricaoMarcaModelo: 'I/TOYOTA HILUX CD4X4', anoModelo: 2008, codigoCombustivel: '03', descricaoTipoVeiculo: 'CAMINHONETE', descricaoEspecie: 'ESPECIAL' } as any,
    })
    expect(vc.fipeCandidato.decididoPor).toBe('ambiguo')
    expect(vc.fipeCandidato.confianca).toBe('baixa')
    expect(vc.fipeCandidato.candidatos.map((c: any) => c.codigo_fipe).sort()).toEqual(['002090-7', '002092-3'])
    // No silent pick of the source's best score.
    expect(vc.fipeCodigo ?? null).not.toBe('002090-7')
    expect(fipeEIncerta(vc)).toBe(true)
    // The judge failure alert still goes out.
    expect(alerta).toHaveBeenCalled()
    const v = validarEscolha({ valorCusto: vc }, '002092-3')
    expect(v.ok).toBe(true)
    expect(validarEscolha({ valorCusto: vc }, '999999-9').ok).toBe(false)
  })
})
