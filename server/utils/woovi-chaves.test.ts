// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'

let config: Record<string, unknown>
let buscas: number
let resposta: () => Promise<unknown>

vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e?.message || 'error'), e))
vi.stubGlobal('$fetch', async () => { buscas += 1; return resposta() })

const { chavesPublicas, verificarAssinatura, CHAVE_PUBLICA_WOOVI_DOCUMENTADA, _zerarChavesWoovi } = await import('./woovi')

function parDeChaves() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  return { pem: publicKey.export({ type: 'spki', format: 'pem' }).toString(), privateKey }
}
function assinar(corpo: string, privateKey: crypto.KeyObject) {
  return crypto.sign('sha256', Buffer.from(corpo), privateKey).toString('base64')
}

describe('Woovi webhook signing keys', () => {
  beforeEach(() => {
    config = { wooviBase: 'https://provider.example.test', wooviAppId: 'fake-app-id' }
    buscas = 0
    resposta = async () => ({ public_keys: [] })
    _zerarChavesWoovi()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('the documented key is a valid RSA public key', () => {
    const chave = crypto.createPublicKey(CHAVE_PUBLICA_WOOVI_DOCUMENTADA)
    expect(chave.asymmetricKeyType).toBe('rsa')
  })

  it('endpoint unreachable: the documented key is still returned', async () => {
    resposta = async () => { throw new Error('403 Forbidden') }
    expect(await chavesPublicas()).toEqual([CHAVE_PUBLICA_WOOVI_DOCUMENTADA])
  })

  it('endpoint unreachable: a signature made with a configured key still verifies', async () => {
    const { pem, privateKey } = parDeChaves()
    config.wooviChavePublica = Buffer.from(pem).toString('base64')
    resposta = async () => { throw new Error('403 Forbidden') }
    const corpo = '{"event":"TEST","charge":{"correlationID":"fake"}}'
    const chaves = await chavesPublicas()
    expect(verificarAssinatura(corpo, assinar(corpo, privateKey), chaves)).toBe(true)
    expect(verificarAssinatura(corpo + ' ', assinar(corpo, privateKey), chaves)).toBe(false)
  })

  it('a signature from an unknown key is refused even with the fixed keys in the list', async () => {
    const { privateKey } = parDeChaves()
    resposta = async () => { throw new Error('403 Forbidden') }
    const corpo = '{"event":"TEST"}'
    expect(verificarAssinatura(corpo, assinar(corpo, privateKey), await chavesPublicas())).toBe(false)
  })

  it('endpoint answers: fetched keys come first and the documented key stays, without duplicates', async () => {
    const { pem } = parDeChaves()
    resposta = async () => ({ public_keys: [{ key: pem }, { key: CHAVE_PUBLICA_WOOVI_DOCUMENTADA }] })
    expect(await chavesPublicas()).toEqual([pem, CHAVE_PUBLICA_WOOVI_DOCUMENTADA])
  })

  it('a failed lookup is not repeated on every call, and is tried again after the pause', async () => {
    vi.useFakeTimers()
    resposta = async () => { throw new Error('403 Forbidden') }
    await chavesPublicas()
    await chavesPublicas()
    await chavesPublicas()
    expect(buscas).toBe(1)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    await chavesPublicas()
    expect(buscas).toBe(2)
  })

  it('a successful lookup is cached and an empty answer falls back to the fixed keys', async () => {
    const { pem } = parDeChaves()
    resposta = async () => ({ public_keys: [{ key: pem }] })
    await chavesPublicas()
    await chavesPublicas()
    expect(buscas).toBe(1)
    _zerarChavesWoovi()
    resposta = async () => ({})
    expect(await chavesPublicas()).toEqual([CHAVE_PUBLICA_WOOVI_DOCUMENTADA])
  })

  it('configured keys accept PEM or base64 and ignore garbage', async () => {
    const a = parDeChaves().pem
    const b = parDeChaves().pem
    config.wooviChavePublica = `${Buffer.from(a).toString('base64')}, not-a-key ,${Buffer.from(b).toString('base64')}`
    resposta = async () => { throw new Error('down') }
    expect(await chavesPublicas()).toEqual([a, b, CHAVE_PUBLICA_WOOVI_DOCUMENTADA])
  })
})
