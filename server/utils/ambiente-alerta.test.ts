import { describe, it, expect, vi, afterEach } from 'vitest'
import { ambienteForaDeProd, comTagAmbiente } from './ambiente-alerta'

const PROD = { public: { gated: false }, supabaseUrl: 'https://fivalpkfneadngxiflea.supabase.co', premiumSupabaseUrl: 'https://fivalpkfneadngxiflea.supabase.co' }
const HOMOLOG = { public: { gated: true, homolog: true }, supabaseUrl: 'https://nqhlxsvggrumgcceamwg.supabase.co' }
const STAGING_DB = { public: { gated: false }, supabaseUrl: 'https://fivalpkfneadngxiflea.supabase.co', premiumSupabaseUrl: 'https://nqhlxsvggrumgcceamwg.supabase.co' }

describe('[HOMOLOG] nos alertas', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('prod nao marca; homolog/gated e banco de staging marcam', () => {
    expect(ambienteForaDeProd(PROD)).toBe(false)
    expect(ambienteForaDeProd(HOMOLOG)).toBe(true)
    expect(ambienteForaDeProd(STAGING_DB)).toBe(true)
  })
  it('prefixa uma vez so', () => {
    expect(comTagAmbiente('Lead de seguro', HOMOLOG)).toBe('[HOMOLOG] Lead de seguro')
    expect(comTagAmbiente('[HOMOLOG] x', HOMOLOG)).toBe('[HOMOLOG] x')
    expect(comTagAmbiente('Lead de seguro', PROD)).toBe('Lead de seguro')
  })
  it('e-mail de erro (estorno, processar): assunto e 1a linha com [HOMOLOG] fora de prod', async () => {
    const enviados: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ ...HOMOLOG, resendApiKey: 're_x' }))
    vi.doMock('resend', () => ({ Resend: class { emails = { send: async (m: any) => { enviados.push(m) } } } }))
    const { sendErrorEmail } = await import('./sendErrorEmail')
    await sendErrorEmail({ endpoint: '/premium/processar', errorMessage: 'ESTORNO teste GFN9891' })
    expect(enviados[0].subject).toMatch(/^\[HOMOLOG\] \[Erro API\] \/premium\/processar/)
    expect(enviados[0].html).toContain('[HOMOLOG] 🚨 Erro na API - PlacaCompleta (teste, não é cliente real)')
  })
  it('em prod o e-mail de erro segue igual', async () => {
    vi.resetModules()
    const enviados: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ ...PROD, resendApiKey: 're_x' }))
    vi.doMock('resend', () => ({ Resend: class { emails = { send: async (m: any) => { enviados.push(m) } } } }))
    const { sendErrorEmail } = await import('./sendErrorEmail')
    await sendErrorEmail({ endpoint: '/premium/processar', errorMessage: 'x' })
    expect(enviados[0].subject).toMatch(/^\[Erro API\]/)
    expect(enviados[0].html).not.toContain('[HOMOLOG]')
  })
})
