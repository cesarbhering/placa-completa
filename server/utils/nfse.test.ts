import { describe, it, expect, vi } from 'vitest'
import { enfileirarNfse } from './nfse'
import { ErroNfseIndisponivel, ErroNfseRejeitado, descricaoDaNota } from './nfse-provedor'

const ID = '11111111-2222-3333-4444-555555555555'

function pedido(over: any = {}) {
  return {
    id: ID, token_entrega: 'tok-fake', placa: 'ABC1D23', plano: 'completa', valor_centavos: 1990,
    pago_em: '2026-11-14T01:30:00Z', entregue_em: '2026-11-14T01:31:00Z', email: 'a@exemplo.test',
    pix_provider: 'abacatepay', canal: 'site', abacatepay_id: 'abc', stripe_session_id: null,
    status: 'entregue', nfse_status: null, nfse_erro: null, ...over,
  }
}

function fakeSb(row: any) {
  const updates: any[] = []
  const calls = { from: 0 }
  return {
    updates, calls,
    from: () => {
      calls.from++
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
        update: (patch: any) => {
          let filtrar = false
          const aplicar = async () => {
            if (filtrar && !(row.nfse_status == null || row.nfse_status === 'a_enfileirar')) return { data: [], error: null }
            updates.push(patch); Object.assign(row, patch); return { data: [{ id: row.id }], error: null }
          }
          const q: any = {
            eq: () => q,
            select: () => q,
            or: (f: string) => { if (f === 'nfse_status.is.null,nfse_status.eq.a_enfileirar') filtrar = true; return q },
            then: (res: any, rej: any) => aplicar().then(res, rej),
          }
          return q
        },
      }
    },
  }
}

const config = { nfse: 'on', nfseDesde: '2026-11-13T00:00:00Z' }
const AGORA = () => new Date('2026-11-14T02:00:00Z')

function deps(over: any = {}) {
  return {
    provedor: { emitir: vi.fn(async () => ({ id: 'nota-1', estado: 'processando' })) } as any,
    lerTomador: vi.fn(async () => ({ documento: '12345678909', nome: 'Fulano de Tal', tipo: 'CPF' as const })),
    agora: AGORA, config, avisar: vi.fn(async () => {}), ...over,
  }
}

describe('enfileirarNfse', () => {
  it('emissor fora nao trava entrega', async () => {
    const sb = fakeSb(pedido())
    const d = deps({ provedor: { emitir: vi.fn(async () => { throw new ErroNfseIndisponivel() }) } })
    await expect(enfileirarNfse(sb, ID, d)).resolves.toBeUndefined()
    expect(sb.updates.at(-1).nfse_status).toBe('a_enfileirar')
    expect(sb.updates.at(-1).nfse_atualizado_em).toBeTruthy()
  })

  it('google_play vira fora_escopo', async () => {
    const sb = fakeSb(pedido({ pix_provider: 'google_play' }))
    const d = deps()
    await enfileirarNfse(sb, ID, d)
    expect(sb.updates.at(-1).nfse_status).toBe('fora_escopo')
    expect(d.provedor.emitir).not.toHaveBeenCalled()
  })

  it('app sem id de pagamento vira fora_escopo', async () => {
    const sb = fakeSb(pedido({ canal: 'app', abacatepay_id: null }))
    await enfileirarNfse(sb, ID, deps())
    expect(sb.updates.at(-1).nfse_status).toBe('fora_escopo')
  })

  it('entregue antes de nfseDesde vira fora_escopo', async () => {
    const sb = fakeSb(pedido({ entregue_em: '2026-11-12T10:00:00Z' }))
    const d = deps()
    await enfileirarNfse(sb, ID, d)
    expect(sb.updates.at(-1).nfse_status).toBe('fora_escopo')
    expect(d.provedor.emitir).not.toHaveBeenCalled()
  })

  it('sem tomador: sem_tomador e avisa uma vez so', async () => {
    const sb = fakeSb(pedido())
    const d = deps({ lerTomador: vi.fn(async () => null) })
    await enfileirarNfse(sb, ID, d)
    await enfileirarNfse(sb, ID, d)
    expect(sb.updates[0].nfse_status).toBe('sem_tomador')
    expect(sb.updates[0].nfse_erro).toBe('sem_tomador_avisado')
    expect(d.avisar).toHaveBeenCalledTimes(1)
    expect(d.provedor.emitir).not.toHaveBeenCalled()
  })

  it('tomador sem nome tambem e sem_tomador', async () => {
    const sb = fakeSb(pedido())
    const d = deps({ lerTomador: vi.fn(async () => ({ documento: '12345678909', nome: null, tipo: 'CPF' })) })
    await enfileirarNfse(sb, ID, d)
    expect(sb.updates.at(-1).nfse_status).toBe('sem_tomador')
  })

  it('caminho feliz: enfileirada com nfse_id e parametros exatos', async () => {
    const sb = fakeSb(pedido())
    const d = deps()
    await enfileirarNfse(sb, ID, d)
    expect(d.provedor.emitir).toHaveBeenCalledWith({
      referencia: ID,
      valorCentavos: 1990,
      competencia: '2026-11-13', // 01:30 UTC = 22:30 em Sao Paulo do dia anterior
      descricao: descricaoDaNota({ plano: 'completa', placa: 'ABC1D23', pedidoId: ID }),
      tomador: { documento: '12345678909', nome: 'Fulano de Tal' },
      email: 'a@exemplo.test',
      metadados: { token: 'tok-fake', plano: 'completa', placa: 'ABC1D23' },
    })
    expect(sb.updates.at(-1)).toMatchObject({ nfse_status: 'enfileirada' })
    expect(sb.updates).toContainEqual(expect.objectContaining({ nfse_id: 'nota-1' }))
  })

  it('resposta sem id fica a_enfileirar', async () => {
    const sb = fakeSb(pedido())
    const d = deps({ provedor: { emitir: vi.fn(async () => ({ estado: 'x' })) } })
    await enfileirarNfse(sb, ID, d)
    expect(sb.updates.at(-1).nfse_status).toBe('a_enfileirar')
  })

  it('rejeicao grava status:code sem o corpo', async () => {
    const sb = fakeSb(pedido())
    const e = new ErroNfseRejeitado(422, { erro: 'corpo_invalido', campos: ['tomador.nome'], mensagem: 'segredo' })
    const d = deps({ provedor: { emitir: vi.fn(async () => { throw e }) } })
    await enfileirarNfse(sb, ID, d)
    const u = sb.updates.at(-1)
    expect(u.nfse_status).toBe('rejeitada')
    expect(u.nfse_erro).toBe('422:corpo_invalido:tomador.nome')
    expect(JSON.stringify(u)).not.toContain('segredo')
  })

  it('400 vira rejeitada; 401 e 404 voltam a a_enfileirar', async () => {
    const run = async (status: number) => {
      const sb = fakeSb(pedido())
      await enfileirarNfse(sb, ID, deps({ provedor: { emitir: vi.fn(async () => { throw new ErroNfseRejeitado(status, { erro: 'x' }) }) } }))
      return sb.updates.at(-1)
    }
    expect((await run(400)).nfse_status).toBe('rejeitada')
    expect((await run(401)).nfse_status).toBe('a_enfileirar')
    expect((await run(404)).nfse_status).toBe('a_enfileirar')
  })

  it('nao sobrescreve status mudado entre leitura e escrita', async () => {
    const row = pedido()
    const sb = fakeSb(row)
    const d = deps({ provedor: { emitir: vi.fn(async () => { row.nfse_status = 'nao_emitir'; return { id: 'nota-1', estado: 'processando' } }) } })
    await enfileirarNfse(sb, ID, d)
    expect(row.nfse_status).toBe('nao_emitir')
    expect(row.nfse_id).toBe('nota-1')
  })

  it('guarda sem linha casada nao envia e-mail de sem_tomador', async () => {
    const row = pedido()
    const sb = fakeSb(row)
    const d = deps({ lerTomador: vi.fn(async () => { row.nfse_status = 'nao_emitir'; return null }) })
    await enfileirarNfse(sb, ID, d)
    expect(d.avisar).not.toHaveBeenCalled()
    expect(row.nfse_status).toBe('nao_emitir')
  })

  it('409 vira rejeitada com 409:erro', async () => {
    const sb = fakeSb(pedido())
    const e = new ErroNfseRejeitado(409, { erro: 'referencia_duplicada' })
    await enfileirarNfse(sb, ID, deps({ provedor: { emitir: vi.fn(async () => { throw e }) } }))
    expect(sb.updates.at(-1)).toMatchObject({ nfse_status: 'rejeitada', nfse_erro: '409:referencia_duplicada' })
  })

  it('erro longo e cortado em 60 chars', async () => {
    const sb = fakeSb(pedido())
    const e = new ErroNfseRejeitado(422, { erro: 'x'.repeat(500), campos: ['a'] })
    await enfileirarNfse(sb, ID, deps({ provedor: { emitir: vi.fn(async () => { throw e }) } }))
    const u = sb.updates.at(-1)
    expect(u.nfse_erro).toBe(`422:${'x'.repeat(60)}:a`)
    expect(u.nfse_erro.length).toBeLessThanOrEqual(200)
  })

  it('NFSE_DESDE vazio ou invalido: nao emite, nao toca no banco, avisa uma vez', async () => {
    vi.resetModules()
    const { enfileirarNfse: fresh } = await import('./nfse')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const nfseDesde of ['', 'lixo']) {
      const sb = fakeSb(pedido())
      const d = deps({ config: { nfse: 'on', nfseDesde } })
      await fresh(sb, ID, d)
      expect(sb.calls.from).toBe(0)
      expect(d.provedor.emitir).not.toHaveBeenCalled()
    }
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('NUXT_NFSE_DESDE'))).toHaveLength(1)
    warn.mockRestore()
  })

  it('flag desligada nao toca no banco', async () => {
    const sb = fakeSb(pedido())
    await enfileirarNfse(sb, ID, deps({ config: { ...config, nfse: '' } }))
    expect(sb.calls.from).toBe(0)
  })

  it('reembolsado vira nao_emitir', async () => {
    const sb = fakeSb(pedido({ status: 'reembolsado' }))
    const d = deps()
    await enfileirarNfse(sb, ID, d)
    expect(sb.updates.at(-1).nfse_status).toBe('nao_emitir')
    expect(d.provedor.emitir).not.toHaveBeenCalled()
  })

  it('status ja definido (e nao a_enfileirar) nao mexe', async () => {
    const sb = fakeSb(pedido({ nfse_status: 'enfileirada' }))
    await enfileirarNfse(sb, ID, deps())
    expect(sb.updates).toHaveLength(0)
  })

  it('sem entregue_em ainda: nao faz nada', async () => {
    const sb = fakeSb(pedido({ entregue_em: null }))
    await enfileirarNfse(sb, ID, deps())
    expect(sb.updates).toHaveLength(0)
  })

  it('nunca lanca, mesmo com o banco quebrado', async () => {
    const sb = { from: () => { throw new Error('boom') } }
    await expect(enfileirarNfse(sb, ID, deps())).resolves.toBeUndefined()
  })
})
