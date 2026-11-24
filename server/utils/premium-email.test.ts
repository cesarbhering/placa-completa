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

describe('enviarRelatorioEmail: linha do cupom de recompra', () => {
  afterEach(() => vi.unstubAllGlobals())
  const cupom = { codigo: 'CARROABCDE', validoAte: '2026-10-12T14:00:00Z' }
  async function enviar(flag: string) {
    const chamadas: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x', premiumBaseUrl: 'https://placacompleta.com.br', cupomRecompraEmail: flag }))
    vi.stubGlobal('$fetch', vi.fn(async (_url: string, opts: any) => { chamadas.push(opts); return {} }))
    const { enviarRelatorioEmail } = await import('./premium-email')
    await enviarRelatorioEmail({ email: 'ana@ex.com', token: 'tok', plano: 'completa', placa: 'ABC1D23', cupom } as any)
    return chamadas[0].body
  }
  it('desligado (padrao): e-mail igual ao de hoje', async () => {
    const b = await enviar('')
    expect(b.html).not.toContain('CARROABCDE')
    expect(b.text).not.toContain('CARROABCDE')
  })
  it('ligado: linha no HTML e no texto', async () => {
    const b = await enviar('on')
    const linha = 'Vai ver outro carro? Use CARROABCDE e ganhe 10% na próxima consulta. Pode compartilhar com quem também está comprando carro. Válido até 12/10.'
    expect(b.text).toContain(linha)
    // No HTML o codigo vem num span de destaque: compara o texto sem as tags.
    expect(b.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).toContain(linha)
  })
  it('ligado: codigo em destaque (mono, maior) e botao do WhatsApp com a mensagem do card', async () => {
    const { mensagemWhatsappRecompra, linkWhatsappRecompra } = await import('../../shared/cupom-recompra-texto')
    const b = await enviar('on')
    expect(b.html).toMatch(/<span style="font-family:[^"]*monospace;font-size:18px;font-weight:700;[^"]*">CARROABCDE<\/span>/)
    expect(b.html).toContain('>Enviar no WhatsApp</a>')
    const href = b.html.match(/<a href="(https:\/\/wa\.me\/\?text=[^"]+)"/)?.[1]
    expect(href).toBe(linkWhatsappRecompra(cupom))
    expect(decodeURIComponent(href!.split('text=')[1])).toBe(mensagemWhatsappRecompra(cupom))
    // texto puro: link do WhatsApp em linha propria
    expect(b.text).toContain(`Enviar no WhatsApp: ${linkWhatsappRecompra(cupom)}`)
    // sem token nem placa no link do WhatsApp
    expect(href).not.toMatch(/tok|ABC1D23|premium/)
    expect(b.html + b.text).not.toContain('—')
  })
  it('desligado: sem botao do WhatsApp', async () => {
    const b = await enviar('')
    expect(b.html).not.toContain('wa.me')
    expect(b.text).not.toContain('wa.me')
  })
})

// App purchase, report complete (Cesar, 24/11/2026). Both texts were approved
// word for word: these tests guard them, so a copy change needs a new approval.
describe('report complete e-mail of app purchases', () => {
  afterEach(() => vi.unstubAllGlobals())
  const LINK = 'https://placacompleta.com.br/premium/TOKFICTICIO?o=email'
  const PAR1_INTEIRO = 'Todas as consultas do seu relatório já terminaram, inclusive as multas e débitos no DETRAN e o histórico de donos e de uso do veículo.'
  const PAR1_CURTO = 'Todas as consultas do seu relatório já terminaram.'
  const PAR2 = 'O link é o mesmo de antes e não expira. Você pode abrir pelo botão abaixo, no celular ou no computador.'

  it('uses exactly the approved subject, title, paragraphs and button', async () => {
    const { montarRelatorioCompleto } = await import('./premium-email')
    const { assunto, html, texto } = montarRelatorioCompleto({ link: LINK, placa: 'ABC1D23', partesProntas: true })
    expect(assunto).toBe('Seu relatório da placa ABC1D23 está completo')
    expect(html).toContain('>Seu relatório está completo.</h1>')
    expect(html).toContain(`>${PAR1_INTEIRO}</p>`)
    expect(html).toContain(`>${PAR2}</p>`)
    expect(html).toMatch(/<a href="https:\/\/placacompleta\.com\.br\/premium\/TOKFICTICIO\?o=email"[^>]*>Ver meu relatório<\/a>/)
    expect(texto.split('\n').slice(0, 7)).toEqual(['Seu relatório está completo.', '', PAR1_INTEIRO, '', PAR2, '', LINK])
  })

  it('the DETRAN or the vehicle history is not in the report: only the short first paragraph, the rest the same', async () => {
    const { montarRelatorioCompleto } = await import('./premium-email')
    const curto = montarRelatorioCompleto({ link: LINK, placa: 'ABC1D23', partesProntas: false })
    const inteiro = montarRelatorioCompleto({ link: LINK, placa: 'ABC1D23', partesProntas: true })
    expect(curto.html).toContain(`>${PAR1_CURTO}</p>`)
    expect(curto.texto.split('\n').slice(0, 7)).toEqual(['Seu relatório está completo.', '', PAR1_CURTO, '', PAR2, '', LINK])
    for (const t of [curto.html, curto.texto]) {
      expect(t).not.toContain('DETRAN')
      expect(t).not.toContain('histórico de donos')
    }
    expect(curto.assunto).toBe(inteiro.assunto)
    expect(curto.html.split(PAR1_CURTO).join('§')).toBe(inteiro.html.split(PAR1_INTEIRO).join('§'))
    expect(curto.texto.split(PAR1_CURTO).join('§')).toBe(inteiro.texto.split(PAR1_INTEIRO).join('§'))
  })

  it('has no apology, no em dash, and the link note is not repeated under the button', async () => {
    const { montarRelatorioCompleto } = await import('./premium-email')
    for (const partesProntas of [true, false]) {
      const { assunto, html, texto } = montarRelatorioCompleto({ link: LINK, placa: 'ABC1D23', partesProntas })
      for (const t of [assunto, html, texto]) {
        expect(t).not.toMatch(/desculpa/i)
        expect(t).not.toContain('—')
      }
      const vezes = (t: string) => t.split('O link é o mesmo de antes e não expira.').length - 1
      expect(vezes(html)).toBe(1)
      expect(vezes(texto)).toBe(1)
      // No empty note paragraph left where the note used to be.
      expect(html).not.toMatch(/<p[^>]*><\/p>/)
    }
  })

  it('keeps the layout of the delivery e-mail: logo, blue button, fallback link and help footer', async () => {
    const { montarRelatorioCompleto } = await import('./premium-email')
    const { html, texto } = montarRelatorioCompleto({ link: LINK, placa: 'ABC1D23', partesProntas: true })
    expect(html).toContain('logo-horizontal-600.png')
    expect(html).toContain('bgcolor="#1f6feb"')
    expect(html).toContain(`Se o botão não funcionar, copie e cole no navegador:<br><a href="${LINK}"`)
    expect(html).toContain('mailto:contato@placacompleta.com.br')
    expect(texto).toContain('Precisa de ajuda? Responda este e-mail ou escreva para contato@placacompleta.com.br')
  })

  it('sends from contato@ through the e-mail provider, with a per-order idempotency key and a timeout', async () => {
    const chamadas: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x', premiumBaseUrl: 'https://placacompleta.com.br' }))
    vi.stubGlobal('$fetch', vi.fn(async (url: string, opts: any) => { chamadas.push({ url, opts }); return { id: 'em_ficticio' } }))
    const { enviarRelatorioCompleto } = await import('./premium-email')
    expect(await enviarRelatorioCompleto({ email: 'cliente@exemplo.com', token: 'TOKFICTICIO', placa: 'ABC1D23', pedidoId: 'pedido-ficticio-1', partesProntas: true })).toBe(true)
    expect(await enviarRelatorioCompleto({ email: 'cliente@exemplo.com', token: 'TOKFICTICIO', placa: 'ABC1D23', pedidoId: 'pedido-ficticio-2', partesProntas: false })).toBe(true)
    expect(chamadas).toHaveLength(2)
    const { url, opts } = chamadas[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(opts.method).toBe('POST')
    // Same key on every retry: the provider answers a repeated key without sending again (24 h window).
    expect(opts.headers['Idempotency-Key']).toBe('relatorio-completo/pedido-ficticio-1')
    expect(opts.timeout).toBeGreaterThan(0)
    expect(opts.body.from).toBe('PlacaCompleta <contato@placacompleta.com.br>')
    expect(opts.body.reply_to).toBe('contato@placacompleta.com.br')
    expect(opts.body.to).toEqual(['cliente@exemplo.com'])
    expect(opts.body.subject).toBe('Seu relatório da placa ABC1D23 está completo')
    expect(opts.body.html).toContain(`href="${LINK}"`)
    expect(opts.body.text).toContain(LINK)
    expect(opts.body.text).toContain(PAR1_INTEIRO)
    expect(chamadas[1].opts.headers['Idempotency-Key']).toBe('relatorio-completo/pedido-ficticio-2')
    expect(chamadas[1].opts.body.text).toContain(PAR1_CURTO)
    expect(chamadas[1].opts.body.text).not.toContain(PAR1_INTEIRO)
  })

  it('no e-mail or no provider key: no call; a provider error returns false without throwing', async () => {
    const chamar = vi.fn(async () => ({}))
    vi.stubGlobal('$fetch', chamar)
    const { enviarRelatorioCompleto } = await import('./premium-email')
    const pedido = { token: 'T', placa: 'ABC1D23', pedidoId: 'p1', partesProntas: true }
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x' }))
    expect(await enviarRelatorioCompleto({ ...pedido, email: null })).toBe(false)
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: '' }))
    expect(await enviarRelatorioCompleto({ ...pedido, email: 'cliente@exemplo.com' })).toBe(false)
    expect(chamar).not.toHaveBeenCalled()
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x' }))
    vi.stubGlobal('$fetch', vi.fn(async () => { throw Object.assign(new Error('falha ficticia'), { statusCode: 500 }) }))
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await enviarRelatorioCompleto({ ...pedido, email: 'cliente@exemplo.com' })).toBe(false)
    erro.mockRestore()
  })

  // The first paragraph can change between a send that answered late and its
  // retry (a block that arrived in between). The provider then refuses the
  // reused key with another body: the first request went, so it counts as sent.
  it('key already used with another body counts as sent; a request still in progress with the key is retried', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x' }))
    const { enviarRelatorioCompleto } = await import('./premium-email')
    const pedido = { email: 'cliente@exemplo.com', token: 'T', placa: 'ABC1D23', pedidoId: 'p1', partesProntas: false }
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('$fetch', vi.fn(async () => { throw Object.assign(new Error('409'), { statusCode: 409, data: { statusCode: 409, name: 'invalid_idempotent_request' } }) }))
    expect(await enviarRelatorioCompleto(pedido)).toBe(true)
    vi.stubGlobal('$fetch', vi.fn(async () => { throw Object.assign(new Error('409'), { statusCode: 409, data: { statusCode: 409, name: 'concurrent_idempotent_requests' } }) }))
    expect(await enviarRelatorioCompleto(pedido)).toBe(false)
    erro.mockRestore()
  })
})

// Review of PR #793: the queue's "report updated" e-mail also carries a key per
// order and type, so a send accepted with a lost answer never becomes two.
describe('report updated e-mail: idempotency key', () => {
  afterEach(() => vi.unstubAllGlobals())
  const itens = { email: 'cliente@exemplo.com', token: 'TOKFICTICIO', placa: 'ABC1D23', fonte: 'DETRAN-SP', itens: [] as string[] }

  it('with a key: it goes in the header, and a key already used with another body counts as sent', async () => {
    const chamadas: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x' }))
    vi.stubGlobal('$fetch', vi.fn(async (_url: string, opts: any) => { chamadas.push(opts); return { id: 'em_ficticio' } }))
    const { enviarAtualizacaoRelatorio } = await import('./premium-email')
    expect(await enviarAtualizacaoRelatorio({ ...itens, idempotencia: 'relatorio-atualizado/pedido-ficticio-1' })).toBe(true)
    expect(chamadas[0].headers['Idempotency-Key']).toBe('relatorio-atualizado/pedido-ficticio-1')
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('$fetch', vi.fn(async () => { throw Object.assign(new Error('409'), { statusCode: 409, data: { name: 'invalid_idempotent_request' } }) }))
    expect(await enviarAtualizacaoRelatorio({ ...itens, idempotencia: 'relatorio-atualizado/pedido-ficticio-1' })).toBe(true)
    erro.mockRestore()
  })

  it('without a key (the late DETRAN notice): no header, and every error stays a failure, as before', async () => {
    const chamadas: any[] = []
    vi.stubGlobal('useRuntimeConfig', () => ({ resendApiKey: 're_x' }))
    vi.stubGlobal('$fetch', vi.fn(async (_url: string, opts: any) => { chamadas.push(opts); return { id: 'em_ficticio' } }))
    const { enviarAtualizacaoRelatorio } = await import('./premium-email')
    expect(await enviarAtualizacaoRelatorio(itens)).toBe(true)
    expect(chamadas[0].headers).not.toHaveProperty('Idempotency-Key')
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('$fetch', vi.fn(async () => { throw Object.assign(new Error('409'), { statusCode: 409, data: { name: 'invalid_idempotent_request' } }) }))
    expect(await enviarAtualizacaoRelatorio(itens)).toBe(false)
    erro.mockRestore()
  })
})
