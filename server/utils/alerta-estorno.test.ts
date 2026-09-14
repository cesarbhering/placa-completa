import { describe, it, expect } from 'vitest'
import { _mascararEmail, _origemDoPedido, _etapaDaFalha, _valorEmReais } from './premium-processar'

// O alerta de estorno vai pro e-mail do Cesar. Ele precisa responder, sem abrir
// o banco: quanto, de onde veio a venda e onde quebrou. E nao pode vazar o
// e-mail inteiro de quem comprou.
describe('alerta de estorno automatico', () => {
  it('mostra o valor em reais, do jeito que se le', () => {
    expect(_valorEmReais(3990)).toBe('R$ 39,90')
    expect(_valorEmReais(2500)).toBe('R$ 25,00')
    expect(_valorEmReais(0)).toBe('nao informado')
    expect(_valorEmReais(null)).toBe('nao informado')
  })

  it('e-mail do cliente sai mascarado', () => {
    expect(_mascararEmail('fulano.detal@gmail.com')).toBe('ful***@gmail.com')
    expect(_mascararEmail('ana@x.com')).toBe('ana@x.com')
    expect(_mascararEmail(null)).toBe('sem e-mail')
    expect(_mascararEmail('quebrado')).toBe('invalido')
  })

  it('origem sai do que estiver gravado no pedido', () => {
    expect(_origemDoPedido({ gclid: 'abc', utm_campaign: 'marca' })).toBe('Google Ads / marca')
    expect(_origemDoPedido({ msclkid: 'xyz' })).toBe('Bing Ads')
    expect(_origemDoPedido({ utm_source: 'email', utm_campaign: 'volta' })).toBe('email / volta')
    expect(_origemDoPedido({})).toBe('organico')
  })

  it('etapa vem do trace: e a primeira pergunta de quem le o alerta', () => {
    const erro: any = new Error('Falha de rede no GCC.')
    erro.trace = [
      { etapa: 'config', ambiente: 'producao' },
      { etapa: 'GCC consentimento', erro: 'TypeError: fetch failed' },
    ]
    expect(_etapaDaFalha(erro)).toBe('GCC consentimento')
  })

  it('sem trace, nao inventa etapa', () => {
    expect(_etapaDaFalha(new Error('qualquer'))).toBe('desconhecida')
    expect(_etapaDaFalha(null)).toBe('desconhecida')
  })
})
