import { describe, it, expect, vi } from 'vitest'
import { cancelarNfse } from './nfse'
import { ErroNfseIndisponivel, ErroNfseRejeitado } from './nfse-provedor'

const ID = '11111111-2222-3333-4444-555555555555'
const config = { nfse: 'on' }

function fakeSb(row: any) {
  const updates: any[] = []
  return {
    updates,
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
      update: (patch: any) => {
        updates.push(patch)
        const q: any = { eq: () => q, is: () => q, or: () => q, then: (res: any) => Promise.resolve({ error: null }).then(res) }
        return q
      },
    }),
  }
}

describe('cancelarNfse', () => {
  it('refund before the note: nao_emitir and the provider is not called', async () => {
    const sb = fakeSb({ nfse_id: null, nfse_status: 'a_enfileirar', nfse_erro: null })
    const provedor = { cancelar: vi.fn() }
    await cancelarNfse(sb, ID, undefined, { provedor, config })
    expect(sb.updates.at(-1).nfse_status).toBe('nao_emitir')
    expect(provedor.cancelar).not.toHaveBeenCalled()
  })

  it('leaves fora_escopo untouched', async () => {
    const sb = fakeSb({ nfse_id: null, nfse_status: 'fora_escopo', nfse_erro: null })
    await cancelarNfse(sb, ID, undefined, { provedor: { cancelar: vi.fn() }, config })
    expect(sb.updates).toEqual([])
  })

  it('with nfse_id: cancels once with the reason and leaves the status to the webhook', async () => {
    const sb = fakeSb({ nfse_id: 'nota-1', nfse_status: 'emitida', nfse_erro: null })
    const provedor = { cancelar: vi.fn(async () => {}) }
    await cancelarNfse(sb, ID, undefined, { provedor, config })
    expect(provedor.cancelar).toHaveBeenCalledTimes(1)
    expect(provedor.cancelar).toHaveBeenCalledWith('nota-1', 'Estorno do pagamento ao cliente')
    expect(sb.updates.some((u) => 'nfse_status' in u)).toBe(false)
  })

  it('409 means already final: nothing written', async () => {
    const sb = fakeSb({ nfse_id: 'nota-1', nfse_status: 'cancelada_x', nfse_erro: null })
    const provedor = { cancelar: vi.fn(async () => { throw new ErroNfseRejeitado(409, {}) }) }
    await expect(cancelarNfse(sb, ID, undefined, { provedor, config })).resolves.toBe('ignorado')
    expect(sb.updates).toEqual([])
  })

  it('other rejection is recorded', async () => {
    const sb = fakeSb({ nfse_id: 'nota-1', nfse_status: 'emitida', nfse_erro: null })
    const provedor = { cancelar: vi.fn(async () => { throw new ErroNfseRejeitado(422, {}) }) }
    await cancelarNfse(sb, ID, undefined, { provedor, config })
    expect(sb.updates.at(-1)).toEqual({ nfse_erro: 'cancelar_rejeitado:422' })
  })

  it('emitter down: cancelar_pendente and no throw', async () => {
    const sb = fakeSb({ nfse_id: 'nota-1', nfse_status: 'emitida', nfse_erro: null })
    const provedor = { cancelar: vi.fn(async () => { throw new ErroNfseIndisponivel() }) }
    await expect(cancelarNfse(sb, ID, undefined, { provedor, config })).resolves.toBe('pendente')
    expect(sb.updates.at(-1)).toEqual({ nfse_erro: 'cancelar_pendente' })
  })

  it('feature off: touches nothing', async () => {
    const sb = fakeSb({ nfse_id: null, nfse_status: null, nfse_erro: null })
    await cancelarNfse(sb, ID, undefined, { provedor: { cancelar: vi.fn() }, config: { nfse: '' } })
    expect(sb.updates).toEqual([])
  })
})
