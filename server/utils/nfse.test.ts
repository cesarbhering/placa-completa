import { describe, it, expect, vi } from 'vitest'
import { enfileirarNfse, aplicarEstadoNfse } from './nfse'
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
    await expect(enfileirarNfse(sb, ID, d)).resolves.toBe('indisponivel')
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
    await expect(enfileirarNfse(sb, ID, d)).resolves.toBe('enfileirada')
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

  it('refund lands while the emitter answers: keeps nao_emitir and cancels the new note', async () => {
    const row: any = pedido()
    const sb = fakeSb(row)
    const cancelar = vi.fn(async () => {})
    const emitir = vi.fn(async () => { row.nfse_status = 'nao_emitir'; return { id: 'nota-1', estado: 'processando' } })
    await expect(enfileirarNfse(sb, ID, deps({ provedor: { emitir, cancelar } }))).resolves.toBe('nao_emitir')
    expect(row.nfse_id).toBe('nota-1')
    expect(cancelar).toHaveBeenCalledTimes(1)
    expect(cancelar).toHaveBeenCalledWith('nota-1', 'Estorno do pagamento ao cliente')
    expect(row.nfse_status).toBe('nao_emitir')
  })

  it('status moved to something else during issuing: no cancel', async () => {
    const row: any = pedido()
    const cancelar = vi.fn(async () => {})
    const emitir = vi.fn(async () => { row.nfse_status = 'enfileirada'; return { id: 'nota-1', estado: 'processando' } })
    await expect(enfileirarNfse(fakeSb(row), ID, deps({ provedor: { emitir, cancelar } }))).resolves.toBe('ignorado')
    expect(cancelar).not.toHaveBeenCalled()
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
    await expect(enfileirarNfse(sb, ID, deps())).resolves.toBe('ignorado')
  })
})

describe('aplicarEstadoNfse', () => {
  const NOTA = { id: 'nota-1', referencia: ID, estado: 'emitida', numero: '42', serie: '1', chave_acesso: 'CH', emitida_em: '2026-11-14T02:00:00Z', cancelada_em: null, erro: null }
  const base = () => ({ id: ID, token_entrega: 'tok-fake', placa: 'ABC1D23', email: 'cliente@example.test', nfse_status: 'enfileirada', nfse_email_em: null as any, nfse_id: null as any })

  function sb(row: any) {
    const updates: any[] = []
    return {
      updates,
      from: () => ({
        update: (patch: any) => {
          let soNulo = false; let excluir: string[] = []; let semReembolso = false
          const q: any = {
            eq: () => q,
            neq: (col: string, v: string) => { if (col === 'status' && v === 'reembolsado') semReembolso = true; return q },
            is: (col: string) => { if (col === 'nfse_email_em') soNulo = true; return q },
            not: (_c: string, _o: string, v: string) => { excluir = v.replace(/[()]/g, '').split(','); return q },
            select: () => q,
            then: (res: any, rej: any) => (async () => {
              if (excluir.includes(row.nfse_status)) return { data: [], error: null }
              if (soNulo && row.nfse_email_em != null) return { data: [], error: null }
              if (semReembolso && row.status === 'reembolsado') return { data: [], error: null }
              updates.push(patch); Object.assign(row, patch); return { data: [{ id: row.id }], error: null }
            })().then(res, rej),
          }
          return q
        },
      }),
    }
  }
  const agora = () => new Date('2026-11-14T03:00:00Z')

  it('emitida: writes fields and sends one e-mail across two deliveries', async () => {
    const row = base(); const s = sb(row)
    const enviarEmail = vi.fn(async () => true); const pdf = vi.fn(async () => Buffer.from('pdf'))
    const deps = { provedor: { pdf }, enviarEmail, agora }
    await aplicarEstadoNfse(s, row, NOTA, deps)
    await aplicarEstadoNfse(s, { ...row }, NOTA, deps)
    expect(row).toMatchObject({ nfse_status: 'emitida', nfse_id: 'nota-1', nfse_numero: '42', nfse_serie: '1', nfse_chave: 'CH', nfse_emitida_em: '2026-11-14T02:00:00Z', nfse_erro: null })
    expect(enviarEmail).toHaveBeenCalledTimes(1)
    expect(row.nfse_email_em).toBe('2026-11-14T03:00:00.000Z')
  })
  it('rejeitada: stores code and sends no e-mail', async () => {
    const row = base(); const enviarEmail = vi.fn()
    await aplicarEstadoNfse(sb(row), row, { ...NOTA, estado: 'rejeitada', erro: { codigo: 'E160', mensagem: 'x' } }, { provedor: { pdf: vi.fn() }, enviarEmail, agora })
    expect(row).toMatchObject({ nfse_status: 'rejeitada', nfse_erro: 'E160' })
    expect(enviarEmail).not.toHaveBeenCalled()
  })
  it('pendente keeps enfileirada', async () => {
    const row = base()
    await aplicarEstadoNfse(sb(row), row, { ...NOTA, estado: 'pendente' }, { enviarEmail: vi.fn(), agora })
    expect(row.nfse_status).toBe('enfileirada')
  })
  it('pdf fetch failure: no e-mail, nfse_email_em stays null', async () => {
    const row = base(); const enviarEmail = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await aplicarEstadoNfse(sb(row), row, NOTA, { provedor: { pdf: async () => { throw new Error('down') } }, enviarEmail, agora })
    expect(enviarEmail).not.toHaveBeenCalled()
    expect(row.nfse_email_em).toBeNull(); expect(row.nfse_status).toBe('emitida')
    warn.mockRestore()
  })
  it('send failure resets nfse_email_em', async () => {
    const row = base()
    await aplicarEstadoNfse(sb(row), row, NOTA, { provedor: { pdf: async () => Buffer.from('p') }, enviarEmail: async () => false, agora })
    expect(row.nfse_email_em).toBeNull()
  })
  it('no e-mail address: no send', async () => {
    const row = { ...base(), email: null }; const enviarEmail = vi.fn()
    await aplicarEstadoNfse(sb(row), row, NOTA, { provedor: { pdf: vi.fn() }, enviarEmail, agora })
    expect(enviarEmail).not.toHaveBeenCalled()
  })
  it('late pendente after emitida keeps everything', async () => {
    const row = { ...base(), nfse_status: 'emitida', nfse_numero: '42' }; const s = sb(row)
    await aplicarEstadoNfse(s, row, { ...NOTA, estado: 'pendente', numero: null }, { enviarEmail: vi.fn(), agora })
    expect(s.updates).toHaveLength(0)
    expect(row).toMatchObject({ nfse_status: 'emitida', nfse_numero: '42' })
  })
  it('old emitida after cancelada keeps cancelada', async () => {
    const row = { ...base(), nfse_status: 'cancelada' }; const s = sb(row); const enviarEmail = vi.fn()
    await aplicarEstadoNfse(s, row, NOTA, { provedor: { pdf: vi.fn() }, enviarEmail, agora })
    expect(s.updates).toHaveLength(0); expect(row.nfse_status).toBe('cancelada'); expect(enviarEmail).not.toHaveBeenCalled()
  })
  it('emitida racing a cancellation (stale pedido) writes nothing and sends nothing', async () => {
    const row = { ...base(), nfse_status: 'cancelada' }; const s = sb(row); const enviarEmail = vi.fn()
    await aplicarEstadoNfse(s, { ...row, nfse_status: 'enfileirada' }, NOTA, { provedor: { pdf: vi.fn() }, enviarEmail, agora })
    expect(row.nfse_status).toBe('cancelada'); expect(enviarEmail).not.toHaveBeenCalled()
  })
  it('late emitida never overwrites nao_emitir nor e-mails the refunded customer', async () => {
    const row = { ...base(), nfse_status: 'nao_emitir', status: 'reembolsado' }; const s = sb(row); const enviarEmail = vi.fn()
    await expect(aplicarEstadoNfse(s, row, NOTA, { provedor: { pdf: vi.fn() }, enviarEmail, agora })).resolves.toBe(false)
    expect(s.updates).toHaveLength(0); expect(row.nfse_status).toBe('nao_emitir'); expect(enviarEmail).not.toHaveBeenCalled()
  })
  it('emitida racing a refund (stale pedido) keeps nao_emitir and sends nothing', async () => {
    const row = { ...base(), nfse_status: 'nao_emitir', status: 'reembolsado' }; const s = sb(row); const enviarEmail = vi.fn()
    await aplicarEstadoNfse(s, { ...row, nfse_status: 'enfileirada' }, NOTA, { provedor: { pdf: vi.fn() }, enviarEmail, agora })
    expect(row.nfse_status).toBe('nao_emitir'); expect(enviarEmail).not.toHaveBeenCalled()
  })
  it('emitida on a refunded order still being cancelled: no e-mail', async () => {
    const row = { ...base(), status: 'reembolsado' }; const enviarEmail = vi.fn()
    await aplicarEstadoNfse(sb(row), row, NOTA, { provedor: { pdf: async () => Buffer.from('p') }, enviarEmail, agora })
    expect(enviarEmail).not.toHaveBeenCalled(); expect(row.nfse_email_em).toBeNull()
  })
  it('returns whether the state changed', async () => {
    const row = base()
    await expect(aplicarEstadoNfse(sb(row), row, { ...NOTA, estado: 'pendente' }, { enviarEmail: vi.fn(), agora })).resolves.toBe(false)
    await expect(aplicarEstadoNfse(sb(row), row, { ...NOTA, estado: 'rejeitada' }, { enviarEmail: vi.fn(), agora })).resolves.toBe(true)
  })
  it('cancelada delivery keeps nfse_numero', async () => {
    const row = { ...base(), nfse_status: 'emitida', nfse_numero: '42', nfse_chave: 'CH' }
    await aplicarEstadoNfse(sb(row), row, { ...NOTA, estado: 'cancelada', numero: null, chave_acesso: null, emitida_em: null, cancelada_em: '2026-11-15T00:00:00Z' }, { enviarEmail: vi.fn(), agora })
    expect(row).toMatchObject({ nfse_status: 'cancelada', nfse_numero: '42', nfse_chave: 'CH', nfse_cancelada_em: '2026-11-15T00:00:00Z' })
  })
  it('warns when the lock reset fails after a failed send', async () => {
    const row = base(); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s: any = sb(row); const orig = s.from
    let n = 0
    s.from = () => { const f = orig(); return { update: (p: any) => { n++; if (p.nfse_email_em === null) { const q: any = { eq: () => q, then: (r: any) => Promise.resolve({ error: { message: 'x' } }).then(r) }; return q } return f.update(p) } } }
    await aplicarEstadoNfse(s, row, NOTA, { provedor: { pdf: async () => Buffer.from('p') }, enviarEmail: async () => false, agora })
    expect(warn.mock.calls.some((c) => String(c[0]).includes('email lock was not released'))).toBe(true)
    warn.mockRestore()
  })
})
