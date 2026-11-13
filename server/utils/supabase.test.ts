// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSupabaseServer } from './supabase'
import { usePremiumSupabase } from './premium-supabase'

// The database client is created once per process and reused. The client
// library is the real one here: nothing is sent at creation, and fake timers
// show whether a client leaves a timer behind.

let config: Record<string, string>
let serie = 0

beforeEach(() => {
  // A fresh pair per test: the clients live in module memory.
  serie++
  config = {
    supabaseUrl: `https://banco-${serie}.test`, supabaseKey: 'chave-de-teste',
    premiumSupabaseUrl: `https://premium-${serie}.test`, premiumSupabaseKey: 'chave-premium-de-teste',
  }
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message), o))
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Lets the client library finish whatever it starts in the background at creation. */
const assentar = () => vi.advanceTimersByTimeAsync(1000)

describe.each([
  ['useSupabaseServer', () => useSupabaseServer(), 'supabaseUrl', 'supabaseKey'],
  ['usePremiumSupabase', () => usePremiumSupabase(), 'premiumSupabaseUrl', 'premiumSupabaseKey'],
] as const)('%s', (_nome, cliente, campoUrl, campoChave) => {
  it('two calls return the same client', () => {
    expect(cliente()).toBe(cliente())
  })

  it('the client answers the query builder the callers use', () => {
    const consulta = cliente().from('qualquer_tabela').select('id').eq('id', 1)
    expect(typeof consulta.maybeSingle).toBe('function')
  })

  it('100 calls leave no timer behind', async () => {
    const antes = vi.getTimerCount()

    for (let i = 0; i < 100; i++) cliente()
    await assentar()

    expect(vi.getTimerCount()).toBe(antes)
  })

  it('another URL gives another client, and the first one is still there afterwards', () => {
    const primeiro = cliente()
    const urlOriginal = config[campoUrl]!

    config[campoUrl] = `https://outro-${serie}.test`
    const segundo = cliente()
    expect(segundo).not.toBe(primeiro)
    expect(cliente()).toBe(segundo)

    config[campoUrl] = urlOriginal
    expect(cliente()).toBe(primeiro)
  })

  it('another key gives another client', () => {
    const primeiro = cliente()

    config[campoChave] = 'outra-chave-de-teste'

    expect(cliente()).not.toBe(primeiro)
  })
})

describe('the two helpers', () => {
  it('each talks to its own database', () => {
    expect(useSupabaseServer()).not.toBe(usePremiumSupabase())
  })

  it('same URL and key in both: one client is enough', () => {
    config.premiumSupabaseUrl = config.supabaseUrl!
    config.premiumSupabaseKey = config.supabaseKey!

    expect(usePremiumSupabase()).toBe(useSupabaseServer())
  })
})

describe('usePremiumSupabase without configuration', () => {
  it.each([
    ['no URL', { premiumSupabaseUrl: '' }],
    ['no key', { premiumSupabaseKey: '' }],
  ])('%s: 503, as before', (_caso, falta) => {
    Object.assign(config, falta)

    expect(() => usePremiumSupabase()).toThrow(expect.objectContaining({ statusCode: 503 }))
  })
})
