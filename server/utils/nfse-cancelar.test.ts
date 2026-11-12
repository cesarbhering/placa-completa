import { describe, it, expect, vi } from 'vitest'
import { cancelarNfse } from './nfse'
import { ErroNfseIndisponivel, ErroNfseRejeitado } from './nfse-provedor'

const ID = '11111111-2222-3333-4444-555555555555'
const config = { nfse: 'on' }
const MOTIVO = 'Estorno do pagamento ao cliente'

// One-row table honouring the is/or filters cancelarNfse uses. `aposLer` runs after
// the first read, to interleave a concurrent writer.
function fakeSb(row: any, aposLer?: () => void) {
  const updates: any[] = []
  let leituras = 0
  return {
    updates,
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            const copia = { ...row }
            if (leituras++ === 0) aposLer?.()
            return { data: copia, error: null }
          },
        }),
      }),
      update: (patch: any) => {
        const fs: Array<() => boolean> = []
        const q: any = {
          eq: () => q,
          is: (c: string, v: any) => { fs.push(() => row[c] === v); return q },
          or: (f: string) => {
            const ok = f.split(',').map((x) => x.split('.'))
            fs.push(() => ok.some(([c, op, v]) => (op === 'is' ? row[c] == null : row[c] === v)))
            return q
          },
          select: () => q,
          then: (res: any) => {
            const hit = fs.every((f) => f())
            if (hit) { updates.push(patch); Object.assign(row, patch) }
            return Promise.resolve({ data: hit ? [{ id: ID }] : [], error: null }).then(res)
          },
        }
        return q
      },
    }),
  }
}

describe('cancelarNfse', () => {
  it('refund before the note: nao_emitir and the provider is not called', async () => {
    const sb = fakeSb({ nfse_id: null, nfse_status: 'a_enfileirar', nfse_erro: null })
    const provedor = { cancelar: vi.fn() }
    await expect(cancelarNfse(sb, ID, undefined, { provedor, config })).resolves.toBe('nao_emitir')
    expect(sb.updates.at(-1).nfse_status).toBe('nao_emitir')
    expect(provedor.cancelar).not.toHaveBeenCalled()
  })

  it('refund racing the emission: the note id lands after the read, so the note is cancelled', async () => {
    const row: any = { nfse_id: null, nfse_status: 'a_enfileirar', nfse_erro: null }
    const sb = fakeSb(row, () => { row.nfse_id = 'nota-1' })
    const provedor = { cancelar: vi.fn(async () => {}) }
    await expect(cancelarNfse(sb, ID, undefined, { provedor, config })).resolves.toBe('cancelando')
    expect(provedor.cancelar).toHaveBeenCalledTimes(1)
    expect(provedor.cancelar).toHaveBeenCalledWith('nota-1', MOTIVO)
    expect(row.nfse_status).not.toBe('nao_emitir')
    expect(['enfileirada', 'emitida']).not.toContain(row.nfse_status)
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
    expect(provedor.cancelar).toHaveBeenCalledWith('nota-1', MOTIVO)
    expect(sb.updates.some((u) => 'nfse_status' in u)).toBe(false)
  })

  it('accepted cancel clears only cancellation errors', async () => {
    for (const [erro, limpa] of [['cancelar_pendente', true], ['cancelar_rejeitado:422', true], ['E160', false]] as const) {
      const row = { nfse_id: 'nota-1', nfse_status: 'emitida', nfse_erro: erro }
      await cancelarNfse(fakeSb(row), ID, undefined, { provedor: { cancelar: vi.fn(async () => {}) }, config })
      expect(row.nfse_erro).toBe(limpa ? null : erro)
    }
  })

  it('409 means already final: nothing written', async () => {
    const sb = fakeSb({ nfse_id: 'nota-1', nfse_status: 'emitida', nfse_erro: null })
    const provedor = { cancelar: vi.fn(async () => { throw new ErroNfseRejeitado(409, {}) }) }
    await expect(cancelarNfse(sb, ID, undefined, { provedor, config })).resolves.toBe('ja_final')
    expect(sb.updates).toEqual([])
  })

  it('409 clears cancelar_pendente so the retry loop stops', async () => {
    const row = { nfse_id: 'nota-1', nfse_status: 'emitida', nfse_erro: 'cancelar_pendente' }
    const provedor = { cancelar: vi.fn(async () => { throw new ErroNfseRejeitado(409, {}) }) }
    await expect(cancelarNfse(fakeSb(row), ID, undefined, { provedor, config })).resolves.toBe('ja_final')
    expect(row.nfse_erro).toBeNull()
    expect(row.nfse_status).toBe('emitida')
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
