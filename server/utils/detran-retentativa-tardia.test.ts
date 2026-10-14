// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { deveRetentarTardio, varrerRetentativasTardias, itensDoBloco } from './detran-retentativa-tardia'
import { erroBrutoDe, brutoDoResultado, registrarCusto } from './infosimples-detran'
import { montarAtualizacaoRelatorio, enviarAtualizacaoRelatorio } from './premium-email'

const T0 = Date.UTC(2026, 9, 14, 18, 23) // 1a falha (ORK8004: 15:23 BRT)
const min = 60 * 1000
const iso = (t: number) => new Date(t).toISOString()
const ENTREGA = [{ criado_em: iso(T0), code: 609 }, { criado_em: iso(T0 + 3 * min), code: 609 }]
const IND = { status: 'indisponivel', uf: 'AL' }

describe('retentativa tardia (605/609)', () => {
  it('30 min depois da 1a falha: tenta; antes nao', () => {
    expect(deveRetentarTardio({ multas: IND, custos: ENTREGA, agora: T0 + 29 * min })).toBe(false)
    expect(deveRetentarTardio({ multas: IND, custos: ENTREGA, agora: T0 + 30 * min })).toBe(true)
  })
  it('depois da tentativa de 30 min (609 de novo): so em 2 h', () => {
    const c = [...ENTREGA, { criado_em: iso(T0 + 31 * min), code: 609 }]
    expect(deveRetentarTardio({ multas: IND, custos: c, agora: T0 + 60 * min })).toBe(false)
    expect(deveRetentarTardio({ multas: IND, custos: c, agora: T0 + 120 * min })).toBe(true)
  })
  it('depois das duas tardias: para (teto); bloco ok ou ultima != 605/609: nao tenta', () => {
    const c = [...ENTREGA, { criado_em: iso(T0 + 31 * min), code: 609 }, { criado_em: iso(T0 + 121 * min), code: 609 }]
    expect(deveRetentarTardio({ multas: IND, custos: c, agora: T0 + 600 * min })).toBe(false)
    expect(deveRetentarTardio({ multas: { status: 'ok', fonte: 'detran_al' }, custos: ENTREGA, agora: T0 + 60 * min })).toBe(false)
    expect(deveRetentarTardio({ multas: IND, custos: [{ criado_em: iso(T0), code: 600 }], agora: T0 + 60 * min })).toBe(false)
  })
  it('retentativa da pagina conta no teto (3 tardias = fim)', () => {
    const c = [...ENTREGA, ...[20, 45, 70].map((m) => ({ criado_em: iso(T0 + m * min), code: 609 }))]
    expect(deveRetentarTardio({ multas: IND, custos: c, agora: T0 + 300 * min })).toBe(false)
  })
})

describe('varredura: chama sem retry imediato e avisa o cliente uma vez', () => {
  function sbFalso(snapDepois: any) {
    const updates: any[] = []
    const builder = (tabela: string) => {
      const b: any = {
        select: () => b, eq: () => b, gte: () => b,
        maybeSingle: async () => ({ data: { relatorio_snapshot: snapDepois } }),
        update: (row: any) => ({ eq: async () => { updates.push(row); return { error: null } } }),
        then: (res: any, rej: any) => Promise.resolve(tabela === 'pedidos_premium'
          ? { data: [{ id: 'p1', placa: 'ORK8004', token_entrega: 'TOK', email: 'c@x.com', relatorio_snapshot: { consulta: { response: [{ ufJurisdicao: 'AL', renavam: '1' }] }, multas: IND } }], error: null }
          : { data: ENTREGA, error: null }).then(res, rej),
      }
      return b
    }
    return { cliente: { from: builder }, updates }
  }
  it('dispara, entra ok, manda o e-mail aprovado e marca cliente_avisado_em', async () => {
    const bloco = { status: 'ok', fonte: 'detran_al', multas_total_centavos: 19523, ipva_total_centavos: 291263, licenciamento_atrasado_ano: 2021 }
    const { cliente, updates } = sbFalso({ consulta: {}, multas: bloco })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const completar = vi.fn(async () => ({ ok: true }))
    const enviarEmail = vi.fn(async () => true)
    const ids = await varrerRetentativasTardias(cliente, { agora: T0 + 31 * min, completar: completar as any, enviarEmail: enviarEmail as any })
    expect(ids).toEqual(['p1'])
    await vi.waitFor(() => expect(updates).toHaveLength(1))
    expect((completar.mock.calls[0] as any)[2]).toMatchObject({ semRetry: true })
    expect((enviarEmail.mock.calls[0] as any)[0]).toEqual({ email: 'c@x.com', token: 'TOK', placa: 'ORK8004', fonte: 'DETRAN-AL', itens: ['Multas em aberto: R$ 195,23', 'IPVA em aberto: R$ 2.912,63', 'Licenciamento atrasado desde 2021'] })
    expect(updates[0].relatorio_snapshot.multas.cliente_avisado_em).toBeTruthy()
  })
  it('ja avisado: nao manda de novo', async () => {
    const { cliente } = sbFalso({ multas: { status: 'ok', fonte: 'detran_al', cliente_avisado_em: 'x' } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const enviarEmail = vi.fn(async () => true)
    const completar = vi.fn(async () => ({ ok: true }))
    await varrerRetentativasTardias(cliente, { agora: T0 + 31 * min, completar: completar as any, enviarEmail: enviarEmail as any })
    await vi.waitFor(() => expect(completar).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(enviarEmail).not.toHaveBeenCalled()
  })
})

describe('e-mail de atualizacao (texto aprovado de 07/out)', () => {
  it('titulo, paragrafos, itens; sem travessao; de contato@', async () => {
    const m = montarAtualizacaoRelatorio({ link: 'https://placacompleta.com.br/premium/TOK', placa: 'ORK8004', fonte: 'DETRAN-AL', itens: itensDoBloco({ multas_total_centavos: 0 }) })
    expect(m.assunto).toBe('Atualizamos o seu relatório da placa ORK8004')
    expect(m.texto).toContain('Seu relatório foi atualizado.')
    expect(m.texto).toContain('Os dados do DETRAN-AL da placa ORK8004 estavam indisponíveis na entrega e já entraram no relatório.')
    expect(m.texto).toContain('Multas em aberto: nada consta')
    expect(m.texto).toContain('Pedimos desculpas pela demora.')
    expect(m.html + m.texto).not.toContain('—')
    expect(m.html + m.texto).not.toMatch(/cupom|senatran/i)
    const enviar = vi.fn(async () => {})
    expect(await enviarAtualizacaoRelatorio({ email: 'c@x.com', token: 'TOK', placa: 'ORK8004', fonte: 'DETRAN-AL', itens: [] }, { config: { premiumBaseUrl: 'https://placacompleta.com.br', supabaseUrl: 'https://fivalpkfneadngxiflea.supabase.co', public: {} }, enviar })).toBe(true)
    expect((enviar.mock.calls[0] as any)[0]).toMatchObject({ from: 'PlacaCompleta <contato@placacompleta.com.br>', reply_to: 'contato@placacompleta.com.br', to: ['c@x.com'] })
  })
})

describe('bruto tambem nas respostas de erro', () => {
  it('609: code, mensagem, errors e header sem parametros nem token', async () => {
    const json = { code: 609, code_message: 'Tentativas excedidas', errors: ['Origem instavel'], header: { api_version: 'v2', service: 'detran/al/infracoes', price: '0.0', parameters: { placa: 'X', token: 'SEGREDO', pkcs12_cert: 'C' }, requested_at: '2026-10-14T15:23:00-03:00' } }
    const e = erroBrutoDe(json)
    expect(e).toEqual({ code: 609, code_message: 'Tentativas excedidas', errors: ['Origem instavel'], header: { api_version: 'v2', service: 'detran/al/infracoes', price: '0.0', requested_at: '2026-10-14T15:23:00-03:00' } })
    expect(JSON.stringify(e)).not.toContain('SEGREDO')
    const linhas: any[] = []
    const sb = { from: () => ({ insert: async (l: any) => { linhas.push(l); return { error: null } } }) }
    await registrarCusto(sb, { pedidoId: 'p', fonte: 'infosimples_detran_al', preco: 0, code: 609, bruto: brutoDoResultado({ code: 609, codeMessage: '', preco: 0, data: null, erroBruto: e }) })
    expect(linhas[0].bruto).toMatchObject({ code: 609, errors: ['Origem instavel'] })
  })
})
