import { describe, it, expect, vi, afterEach } from 'vitest'
import { deveAvisarClienteEstorno, enviarEstornoEmail } from './premium-email'

// E-mail de estorno pro cliente: dispara SO quando o estorno automatico deu
// certo e o pedido tem e-mail. Transacional (Resend), fail-open.

describe('deveAvisarClienteEstorno', () => {
  it('envia no ok com e-mail', () => {
    expect(deveAvisarClienteEstorno(true, 'ana@ex.com')).toBe(true)
  })
  it('NAO envia quando o reembolso falhou', () => {
    expect(deveAvisarClienteEstorno(false, 'ana@ex.com')).toBe(false)
  })
  it('NAO envia sem e-mail', () => {
    expect(deveAvisarClienteEstorno(true, null)).toBe(false)
    expect(deveAvisarClienteEstorno(true, '')).toBe(false)
    expect(deveAvisarClienteEstorno(true, undefined)).toBe(false)
  })
})

describe('enviarEstornoEmail', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function stub(key: string) {
    const chamadas: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: key }))
    vi.stubGlobal('$fetch', vi.fn(async (_url: string, opts: any) => { chamadas.push(opts); return {} }))
    return chamadas
  }

  it('NAO chama a Resend sem e-mail', async () => {
    const c = stub('re_x')
    expect(await enviarEstornoEmail({ email: null, placa: 'ABC1D23' })).toBe(false)
    expect(c.length).toBe(0)
  })

  it('NAO chama a Resend sem a chave', async () => {
    const c = stub('')
    expect(await enviarEstornoEmail({ email: 'ana@ex.com', placa: 'ABC1D23' })).toBe(false)
    expect(c.length).toBe(0)
  })

  it('Pix: assunto com placa, frase "pagos via Pix" e prazo do Pix', async () => {
    const c = stub('re_x')
    const ok = await enviarEstornoEmail({ email: 'ana@ex.com', placa: 'abc1d23', valorCentavos: 3990, formaPagamento: 'pix' })
    expect(ok).toBe(true)
    expect(c.length).toBe(1)
    const body = c[0].body
    // Regra do Cesar (01/out): e-mail a cliente sai de contato@, nunca de noreply@.
    expect(body.from).toBe('PlacaCompleta <contato@placacompleta.com.br>')
    expect(body.reply_to).toBe('contato@placacompleta.com.br')
    expect(body.reply_to).toBe('contato@placacompleta.com.br')
    expect(body.to).toEqual(['ana@ex.com'])
    expect(body.subject).toBe('Seu pagamento da consulta ABC1D23 foi reembolsado')
    expect(body.text).toContain('pagos via Pix')
    expect(body.text).toContain('R$ 39,90')
    expect(body.text).toContain('volta para a mesma conta')
    expect(body.text).not.toContain('10 dias')
  })

  it('Cartao: frase "pagos via cartão" e prazo de 10 dias uteis', async () => {
    const c = stub('re_x')
    await enviarEstornoEmail({ email: 'ana@ex.com', placa: 'ABC1D23', valorCentavos: 3990, formaPagamento: 'cartao' })
    const body = c[0].body
    expect(body.text).toContain('pagos via cartão')
    expect(body.text).toContain('10 dias úteis')
    expect(body.text).not.toContain('volta para a mesma conta')
  })
})

describe('enviarRelatorioEmail: remetente', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('entrega do relatorio sai de contato@ (nunca noreply@), resposta em contato@', async () => {
    const chamadas: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x', premiumBaseUrl: 'https://placacompleta.com.br' }))
    vi.stubGlobal('$fetch', vi.fn(async (_url: string, opts: any) => { chamadas.push(opts); return {} }))
    const { enviarRelatorioEmail } = await import('./premium-email')
    expect(await enviarRelatorioEmail({ email: 'ana@ex.com', token: 'tok', plano: 'completa', placa: 'ABC1D23' } as any)).toBe(true)
    expect(chamadas[0].body.from).toBe('PlacaCompleta <contato@placacompleta.com.br>')
    expect(chamadas[0].body.reply_to).toBe('contato@placacompleta.com.br')
    expect(JSON.stringify(chamadas[0].body)).not.toContain('noreply@')
  })
})
