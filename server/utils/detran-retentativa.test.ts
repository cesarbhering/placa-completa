import { describe, it, expect, vi, beforeEach } from 'vitest'

const disparos: any[] = []
vi.mock('./infosimples-detran', async (orig) => ({ ...(await orig<any>()), completarDetranDepois: (...a: any[]) => { disparos.push(a) } }))
const { deveRetentarDetran, retentarDetranSeValer, MAX_CHAMADAS } = await import('./detran-retentativa')

// EWX4852 (07/out): Infosimples SP 609 nas 2 chamadas da entrega, bloco
// 'indisponivel' pra sempre. Agora a Infosimples e tentada de novo ao servir.
const agora = Date.parse('2026-10-08T12:00:00Z')
const min = (m: number) => new Date(agora - m * 60_000).toISOString()

describe('deveRetentarDetran', () => {
  it('indisponivel, ultima chamada ha 30 min: tenta', () => {
    expect(deveRetentarDetran({ multas: { status: 'indisponivel', uf: 'SP' }, entregueEm: min(60), chamadas: 2, ultimaChamadaEm: min(30), agora })).toBe(true)
  })
  it('respeita intervalo, teto e estados finais', () => {
    expect(deveRetentarDetran({ multas: { status: 'indisponivel' }, entregueEm: min(60), chamadas: 2, ultimaChamadaEm: min(5), agora })).toBe(false)
    expect(deveRetentarDetran({ multas: { status: 'indisponivel' }, entregueEm: min(600), chamadas: MAX_CHAMADAS, ultimaChamadaEm: min(300), agora })).toBe(false)
    for (const status of ['ok', 'sem_debito', 'protegido']) expect(deveRetentarDetran({ multas: { status, fonte: 'detran_sp' }, entregueEm: min(600), chamadas: 1, ultimaChamadaEm: min(300), agora })).toBe(false)
  })
  it('sem bloco: espera a chamada da entrega terminar (15 min)', () => {
    expect(deveRetentarDetran({ multas: null, entregueEm: min(3), chamadas: 0, ultimaChamadaEm: null, agora })).toBe(false)
    expect(deveRetentarDetran({ multas: null, entregueEm: min(40), chamadas: 0, ultimaChamadaEm: null, agora })).toBe(true)
  })
})

describe('retentarDetranSeValer', () => {
  beforeEach(() => { disparos.length = 0 })
  const sb = (linhas: any[]) => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: linhas }) }) }) }) }) })
  const resp = [{ ufJurisdicao: 'SP', renavam: '123', indicadorMultaRenainf: true }]
  it('SP indisponivel ha tempo: dispara a Infosimples', async () => {
    const ok = await retentarDetranSeValer(sb([{ criado_em: '2026-01-01T00:00:00Z' }, { criado_em: '2026-01-01T00:00:00Z' }]), { id: 'p1', placa: 'EWX4852', entregue_em: '2026-01-01T00:00:00Z' }, { status: 'indisponivel', uf: 'SP' }, resp)
    expect(ok).toBe(true)
    expect(disparos).toHaveLength(1)
  })
  it('UF com gate renainf sem RENAINF: nao chama', async () => {
    const ok = await retentarDetranSeValer(sb([]), { id: 'p1', placa: 'X', entregue_em: '2026-01-01T00:00:00Z' }, null, [{ ufJurisdicao: 'SC', renavam: '1', indicadorMultaRenainf: false }])
    expect(ok).toBe(false)
    expect(disparos).toHaveLength(0)
  })
})
