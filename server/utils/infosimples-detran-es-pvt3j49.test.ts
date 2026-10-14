// @vitest-environment node
import { describe, it, expect } from 'vitest'
import PVT from './__fixtures__/infosimples-detran-es-pvt3j49.json'
import { blocoDetranDaUf, parsearDetranEs, emAberto, sanearBlocoMultas, parsearDetranCe } from './infosimples-detran'

// Caso real PVT3J49 (ES, 14/out), resposta do /detran/es/veiculo saneada
// (nome, renavam, placa e recibo trocados). Antes: multa com R$ 0, recurso so
// com o auto, IPVA e licenciamento zerados (o ES manda normalizado_atual).
const HOJE = new Date('2026-10-14T12:00:00-03:00')
const silencioso = () => {}

describe('DETRAN-ES PVT3J49', () => {
  const b: any = blocoDetranDaUf('ES', PVT)
  const p: any = sanearBlocoMultas(parsearDetranEs(PVT, HOJE, silencioso))

  it('multa em aberto com o valor do debito casado pelo auto e a hora "0913"', () => {
    expect(p.multas_itens).toEqual([{
      auto: 'PRF-000100-J004903355-7463/00', descricao: 'TRANSITAR VELOC SUP MAX PERMITIDA EM MAIS DE 20% ATE 50%',
      dataInfracao: '02/11/2025', horaInfracao: '09:13', local: 'ES - BR 101 - KM 297.05 - C', municipio: 'CARIACICA',
      orgao: null, valor: 199.29, dataVencimento: null,
    }])
    expect(p.multas_total_centavos).toBe(19929)
  })
  it('recurso deferido (2020, so com o auto) nao aparece', () => {
    expect(p.multas_em_recurso).toEqual([])
  })
  it('IPVA (18 cotas 2024 a 2026) e licenciamento (4 anos) com o valor atual', () => {
    expect(p.ipva_total_centavos).toBe(301720)
    expect(p.ipva_itens).toHaveLength(18)
    expect(p.ipva_itens[0]).toMatchObject({ ano: 2026, vencimento: expect.stringMatching(/^\d{2}\/\d{2}\/2026$/) })
    expect(p.licenciamento_centavos).toBe(94816)
    expect(p.licenciamento_atrasado_ano).toBe(2021)
  })
  it('nunca grava nome, renavam nem recibo', () => {
    const out = JSON.stringify(b)
    for (const x of ['FULANO', '00000000000', 'storage.invalid', 'codigo_renainf']) expect(out).not.toContain(x)
  })
})

describe('regra do Cesar: paga/quitada/cancelada nao aparece; recurso so com descricao e valor', () => {
  it('emAberto', () => {
    const l = [{ status: 'Em Aberto' }, { status: 'PAGA' }, { situacao: 'Quitada' }, { status: 'Cancelada' }, { situacao: 'Processo Deferido' }, { situacao: 'Processo Indeferido' }, { status: 'A PAGAR' }, { status: 'Pagamento pendente' }, {}]
    expect(emAberto(l).map((x: any) => x.status ?? x.situacao ?? '-')).toEqual(['Em Aberto', 'Processo Indeferido', 'A PAGAR', 'Pagamento pendente', '-'])
  })
  it('CE: multa paga no meio da lista nao entra nem soma', () => {
    const c = parsearDetranCe({ multas: [{ ait: 'A1', descricao: 'X', normalizado_valor: 100, status: 'Em aberto' }, { ait: 'A2', descricao: 'Y', normalizado_valor: 50, status: 'Paga' }] })
    expect(c.multas_itens.map((m: any) => m.auto)).toEqual(['A1'])
    expect(c.multas_total_centavos).toBe(10000)
  })
  it('saneador: recurso sem descricao ou sem valor sai', () => {
    const s: any = sanearBlocoMultas({ multas_itens: [], multas_em_recurso: [{ auto: '1', descricao: null, valor: 0 }, { auto: '2', descricao: 'AVANCAR SINAL', valor: 0 }, { auto: '3', descricao: 'AVANCAR SINAL', valor: 293.47 }] } as any)
    expect(s.multas_em_recurso.map((m: any) => m.auto)).toEqual(['3'])
  })
  it('ES: multa sem valor nem debito do auto fica com valor 0 (a tela mostra "valor a definir")', () => {
    const x: any = parsearDetranEs({ multas: [{ numero_auto: 'Z9', status: 'Em Aberto', descricao: 'ESTACIONAR', data_hora: '01/10/2026 1010' }], debitos: [] }, HOJE, silencioso)
    expect(x.multas_itens[0]).toMatchObject({ auto: 'Z9', valor: 0, horaInfracao: '10:10' })
  })
})

describe('backfill refazer', () => {
  it('com o bloco da fonte: sem refazer pula; com refazer reconsulta', async () => {
    const { vi } = await import('vitest')
    const { completarDetran } = await import('./infosimples-detran')
    vi.stubGlobal('useRuntimeConfig', () => ({ infosimplesToken: 't', infosimplesEncKey: 'k'.repeat(32), infosimplesPkcs12B64: 'PFX', infosimplesPkcs12Pass: 'p' }))
    const f = vi.fn(async () => ({ status: 200, json: async () => ({ code: 200, header: { price: '0.28' }, data: [PVT] }) }))
    vi.stubGlobal('fetch', f)
    const updates: any[] = []
    const sb = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { relatorio_snapshot: { consulta: {}, multas: { fonte: 'detran_es', status: 'ok' } } } }) }) }),
        insert: async () => ({ error: null }),
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
      }),
    }
    const resp = [{ ufJurisdicao: 'ES', renavam: '1042881020' }]
    expect(await completarDetran(sb, { id: 'p', placa: 'PVT3J49' }, { response: resp, ignorarGate: true })).toMatchObject({ ok: false, pulado: 'ja tem detran_es' })
    expect(f).not.toHaveBeenCalled()
    const r = await completarDetran(sb, { id: 'p', placa: 'PVT3J49' }, { response: resp, ignorarGate: true, refazer: true, semRetry: true })
    expect(r.ok).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
    expect(updates.at(-1).relatorio_snapshot.multas).toMatchObject({ multas_total_centavos: 19929, ipva_total_centavos: 301720 })
    vi.unstubAllGlobals()
  })
})
