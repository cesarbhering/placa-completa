import { describe, it, expect, vi, afterEach } from 'vitest'
import { completarDetran, ehVeiculoProtegido } from './infosimples-detran'
import { textoDetranProtegido } from '../../shared/detran-protegido'

// MES3261 (DETRAN-SC): code 620 "O veículo consultado está protegido...", ~8 s,
// cobrado (R$ 0,28). Proprietario bloqueou a consulta: status final, sem retry.
const cfg = () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' })
function fakeSb(snap: any = { consulta: {} }) {
  const inserts: any[] = []; const updates: any[] = []
  return {
    inserts, updates,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: snap } }) }) }),
      insert: async (row: any) => { inserts.push(row); return { error: null } },
      update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
    }),
  }
}
const resp = [{ ufJurisdicao: 'SC', renavam: '1095390000', indicadorMultaRenainf: true }]
const PROTEGIDO = { code: 620, code_message: 'Erro na consulta.', header: { price: '0.28' }, errors: ['O veículo consultado está protegido. Entre em contato com o proprietário do veículo.'] }

describe('DETRAN: veiculo protegido pelo proprietario', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('reconhece 620 + "protegido" (qualquer UF), e so isso', () => {
    expect(ehVeiculoProtegido({ code: 620, codeMessage: '', erros: PROTEGIDO.errors })).toBe(true)
    expect(ehVeiculoProtegido({ code: 620, codeMessage: 'Veículo protegido', erros: [] })).toBe(true)
    expect(ehVeiculoProtegido({ code: 620, codeMessage: 'Erro qualquer', erros: ['outro erro'] })).toBe(false)
    expect(ehVeiculoProtegido({ code: 609, codeMessage: '', erros: ['protegido'] })).toBe(false)
  })

  it('1 chamada so, custo registrado, status protegido com fonte (backfill pula depois)', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    const fetchSpy = vi.fn(async () => ({ status: 200, json: async () => PROTEGIDO }))
    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = fakeSb()
    const r = await completarDetran(sb, { id: 'abcdef12-0000', placa: 'MES3261' }, { response: resp, esperaRetryMs: 0 })
    expect(r).toMatchObject({ ok: false, code: 620, motivo: 'protegido pelo proprietario' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(sb.inserts.map((i) => i.code)).toEqual([620])
    expect(sb.updates.at(-1).relatorio_snapshot.multas).toEqual({ status: 'protegido', uf: 'SC', fonte: 'detran_sc' })
  })

  it('pedido ja marcado protegido nao chama de novo', async () => {
    vi.stubGlobal('useRuntimeConfig', cfg)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const sb = fakeSb({ consulta: {}, multas: { status: 'protegido', uf: 'SC', fonte: 'detran_sc' } })
    const r = await completarDetran(sb, { id: 'p1', placa: 'MES3261' }, { response: resp })
    expect(r.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('texto da tela, sem travessao', () => {
    expect(textoDetranProtegido('sc')).toBe('No DETRAN-SC, o proprietário bloqueou a consulta pública deste veículo. Peça ao vendedor o extrato de débitos do DETRAN antes de fechar negócio.')
    expect(textoDetranProtegido('SC')).not.toContain('—')
  })
})
