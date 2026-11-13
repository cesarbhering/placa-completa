// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { assertAdminSecret } from './admin-secret'

const SEGREDO = 'segredo-de-teste'

function ambiente(adminSecret: unknown) {
  vi.stubGlobal('useRuntimeConfig', () => ({ adminSecret }))
  vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.message), e))
  vi.stubGlobal('getRequestHeader', (ev: any, nome: string) => ev.headers[nome])
}
const pedidoCom = (headers: Record<string, string>) => ({ headers }) as any
const comSegredo = (enviado: string) => pedidoCom({ 'x-admin-secret': enviado })

/** The guard either returns or throws; this captures what it threw. */
function barrado(event: any): unknown {
  try {
    assertAdminSecret(event)
  } catch (e) {
    return e
  }
  return null
}

describe('assertAdminSecret', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('right secret: lets the request through', () => {
    ambiente(SEGREDO)
    expect(barrado(comSegredo(SEGREDO))).toBeNull()
  })

  it.each([
    ['a different value of another length', 'errado'],
    ['a different value of the same length', 'segredo-de-testE'],
    ['a prefix of the secret', 'segredo-de-test'],
    ['the secret followed by more characters', 'segredo-de-teste!'],
    ['an empty value', ''],
  ])('wrong secret (%s): 404', (_caso, enviado) => {
    ambiente(SEGREDO)
    expect(barrado(comSegredo(enviado))).toMatchObject({ statusCode: 404 })
  })

  it('missing header: 404', () => {
    ambiente(SEGREDO)
    expect(barrado(pedidoCom({}))).toMatchObject({ statusCode: 404 })
  })

  it('the secret in another header does not count', () => {
    ambiente(SEGREDO)
    expect(barrado(pedidoCom({ authorization: SEGREDO, 'x-premium-pass': SEGREDO }))).toMatchObject({ statusCode: 404 })
  })

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['null', null],
  ])('secret not configured (%s): 404 whatever is sent', (_caso, configurado) => {
    ambiente(configurado)
    expect(barrado(pedidoCom({}))).toMatchObject({ statusCode: 404 })
    expect(barrado(comSegredo(''))).toMatchObject({ statusCode: 404 })
    expect(barrado(comSegredo('undefined'))).toMatchObject({ statusCode: 404 })
    expect(barrado(comSegredo('null'))).toMatchObject({ statusCode: 404 })
  })

  it('same number of characters with a non-ASCII one: 404', () => {
    ambiente(SEGREDO)
    // Same length in characters as the secret, one more byte in UTF-8.
    const enviado = 'segredo-de-testé'
    expect(enviado).toHaveLength(SEGREDO.length)
    expect(barrado(comSegredo(enviado))).toMatchObject({ statusCode: 404 })
  })

  it('same number of bytes with non-ASCII characters: 404', () => {
    ambiente(SEGREDO)
    // 16 bytes in UTF-8, like the secret, in fewer characters.
    const enviado = 'segredo-de-téé'
    expect(Buffer.byteLength(enviado)).toBe(Buffer.byteLength(SEGREDO))
    expect(barrado(comSegredo(enviado))).toMatchObject({ statusCode: 404 })
  })
})
