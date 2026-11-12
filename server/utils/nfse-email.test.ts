import { describe, it, expect, vi } from 'vitest'
import { montarEmailNfse, enviarNfseEmail } from './premium-email'

describe('montarEmailNfse', () => {
  const m = montarEmailNfse({ link: 'https://x.test/premium/tok?o=nfse', placa: 'ABC1D23', numero: '42' })
  it('uses the exact subject and title', () => {
    expect(m.assunto).toBe('Sua nota fiscal do relatório da placa ABC1D23')
    expect(m.html).toContain('Nota fiscal emitida')
    expect(m.html).toContain('Ver meu relatório')
  })
  it('has no SENATRAN and no em dash', () => {
    expect(m.html + m.texto).not.toMatch(/SENATRAN/i)
    expect(m.html + m.texto).not.toContain('—')
  })
})

describe('enviarNfseEmail', () => {
  const cfg = { premiumBaseUrl: 'https://x.test', resendApiKey: 'k' }
  it('attaches the PDF as base64 and links to the report', async () => {
    const enviar = vi.fn(async () => {})
    const ok = await enviarNfseEmail({ email: 'cliente@example.test', token: 'tok', placa: 'ABC1D23', numero: '42', pdf: Buffer.from('%PDF-x') }, { config: cfg, enviar })
    expect(ok).toBe(true)
    const msg = (enviar.mock.calls[0] as any[])[0]
    expect(msg.attachments).toEqual([{ filename: 'nfse-42.pdf', content: Buffer.from('%PDF-x').toString('base64') }])
    expect(msg.to).toEqual(['cliente@example.test'])
    expect(msg.html).toContain('https://x.test/premium/tok?o=nfse')
    expect(msg.from).toBe('PlacaCompleta <contato@placacompleta.com.br>')
  })
  it('falls back to nfse.pdf when numero is missing', async () => {
    const enviar = vi.fn(async () => {})
    await enviarNfseEmail({ email: 'cliente@example.test', token: 'tok', placa: 'ABC1D23', numero: '', pdf: Buffer.from('x') }, { config: cfg, enviar })
    expect((enviar.mock.calls[0] as any[])[0].attachments[0].filename).toBe('nfse.pdf')
  })
  it('returns false and does not throw when sending fails', async () => {
    const enviar = vi.fn(async () => { throw new Error('boom') })
    expect(await enviarNfseEmail({ email: 'cliente@example.test', token: 't', placa: 'A', numero: '1', pdf: Buffer.from('x') }, { config: cfg, enviar })).toBe(false)
  })
  it('returns false without e-mail', async () => {
    expect(await enviarNfseEmail({ email: null, token: 't', placa: 'A', numero: '1', pdf: Buffer.from('x') }, { config: cfg, enviar: vi.fn() })).toBe(false)
  })
})
