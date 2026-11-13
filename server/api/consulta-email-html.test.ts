import { describe, it, expect, afterEach, vi } from 'vitest'
import { montarConsulta, veiculoTeste } from '../../tests/helpers/consulta-harness'
import { ufDoCorpo } from '../utils/icv5'

// The result e-mail (and the same HTML rendered to an image for WhatsApp) only
// carries text: values from the request body or from an external source are
// validated against a closed list or escaped before they reach the markup.
const MARCACAO = '<img src="https://example.test/x.png">'
const EMAIL = 'pessoa@example.com'

afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('~/server/utils/icv5'); vi.doUnmock('~/server/utils/seguro-estimate') })

describe('ufDoCorpo: UF accepted from the request body', () => {
  it('accepts the 27 codes, in any case and with spaces around', () => {
    expect(ufDoCorpo('SP')).toBe('SP')
    expect(ufDoCorpo(' rj ')).toBe('RJ')
    expect(ufDoCorpo('df')).toBe('DF')
  })

  it('anything else counts as not sent', () => {
    for (const v of ['', 'XX', 'SPX', 'S', MARCACAO, 'SP<b>', null, undefined, 11, {}, ['SP'], true]) {
      expect(ufDoCorpo(v), JSON.stringify(v)).toBeNull()
    }
  })
})

describe('free lookup e-mail: the UF of the 5-year cost block', () => {
  it('a valid UF shows the block with that UF', async () => {
    const h = await montarConsulta()
    await h.chamar({ channel: 'email', email: EMAIL, icv5Uf: 'mg' })
    expect(h.estado.emails).toHaveLength(1)
    expect(h.estado.emails[0].html).toContain('ICV5 - Custo para Manter em 5 Anos em MG')
  })

  it('a value outside the list is ignored: no block, and nothing of it in the e-mail', async () => {
    const h = await montarConsulta()
    await h.chamar({ channel: 'email', email: EMAIL, icv5Uf: MARCACAO })
    const html = h.estado.emails[0].html as string
    expect(html).not.toContain('ICV5')
    expect(html).not.toContain('example.test')
    expect(html).not.toContain('<img src="https://example.test')
  })

  it('a non-string value is ignored without failing the lookup', async () => {
    const h = await montarConsulta()
    const r = await h.chamar({ channel: 'email', email: EMAIL, icv5Uf: { toUpperCase: 'x' } })
    expect(r.success).toBe(true)
    expect(h.estado.emails[0].html).not.toContain('ICV5')
  })

  it('SP still gets the rodizio block; another UF does not', async () => {
    const h = await montarConsulta()
    await h.chamar({ channel: 'email', email: EMAIL, icv5Uf: 'SP' })
    expect(h.estado.emails[0].html).toContain('Rodízio Municipal')
    const h2 = await montarConsulta()
    await h2.chamar({ channel: 'email', email: EMAIL, icv5Uf: 'PR' })
    expect(h2.estado.emails[0].html).not.toContain('Rodízio Municipal')
  })

  it('the UF is escaped where the e-mail is assembled, whatever the calculation returns', async () => {
    const h = await montarConsulta({
      mocks: { '~/server/utils/icv5': (orig) => ({ ...orig, calcularICV5: (a: any) => ({ ...orig.calcularICV5(a), uf: MARCACAO }) }) },
    })
    await h.chamar({ channel: 'email', email: EMAIL, icv5Uf: 'SP' })
    const html = h.estado.emails[0].html as string
    expect(html).toContain('ICV5 - Custo para Manter em 5 Anos em &lt;img src=&quot;https://example.test/x.png&quot;&gt;')
    expect(html).not.toContain(MARCACAO)
  })

  it('the HTML sent to the image renderer (WhatsApp) gets the same treatment', async () => {
    const h = await montarConsulta({ config: { public: { whatsappEnabled: true }, gotenbergUrl: 'http://renderer.test' } })
    await h.chamar({ channel: 'whatsapp', phone: '11999990000', icv5Uf: MARCACAO })
    expect(h.estado.htmlRenderizado).toHaveLength(1)
    expect(h.estado.htmlRenderizado[0]).not.toContain('example.test')
    expect(h.estado.htmlRenderizado[0]).not.toContain('ICV5')
  })
})

describe('free lookup e-mail: values from external sources', () => {
  it('vehicle fields from the plate source are escaped', async () => {
    const h = await montarConsulta({ veiculo: veiculoTeste({ MODELO: MARCACAO, cor: '<b>cor</b>' }) })
    await h.chamar({ channel: 'email', email: EMAIL, icv5Uf: 'SP' })
    const html = h.estado.emails[0].html as string
    expect(html).not.toContain(MARCACAO)
    expect(html).not.toContain('<b>cor</b>')
    expect(html).toContain('&lt;b&gt;cor&lt;/b&gt;')
  })

  it('the insurance region description (external service) is escaped', async () => {
    const seguro = { premioAnual: 2500, franquia: 4000, regiao: { codigo: '11', descricao: MARCACAO }, regiaoDoUsuario: true, veiculo: { marca: 'M', modelo: 'X', ano: 2021 } }
    const veiculo = veiculoTeste()
    veiculo.fipe.dados[0].codigo_modelo = '001234-5'
    const h = await montarConsulta({
      veiculo,
      mocks: {
        '~/server/utils/fipe-api': () => ({ fipePriceHistory: async () => ({ bruto: { model: { id: 7 }, price_history: [] } }), fipeSeguroEstimado: async () => null }),
        '~/server/utils/seguro-estimate': () => ({ getSeguroEstimado: async () => seguro }),
      },
    })
    await h.chamar({ channel: 'email', email: EMAIL })
    const html = h.estado.emails[0].html as string
    expect(html).toContain('Seguro médio anual')
    expect(html).not.toContain(MARCACAO)
    expect(html).toContain('&lt;img src=')
  })

  it('insurance amounts that are not numbers never reach the markup as text', async () => {
    const seguro = { premioAnual: MARCACAO, franquia: MARCACAO, regiao: { codigo: '11', descricao: 'Região' }, regiaoDoUsuario: false, veiculo: { marca: 'M', modelo: 'X', ano: 2021 } }
    const veiculo = veiculoTeste()
    veiculo.fipe.dados[0].codigo_modelo = '001234-5'
    const h = await montarConsulta({
      veiculo,
      mocks: {
        '~/server/utils/fipe-api': () => ({ fipePriceHistory: async () => ({ bruto: { model: { id: 7 }, price_history: [] } }), fipeSeguroEstimado: async () => null }),
        '~/server/utils/seguro-estimate': () => ({ getSeguroEstimado: async () => seguro }),
      },
    })
    await h.chamar({ channel: 'email', email: EMAIL })
    expect(h.estado.emails[0].html).not.toContain(MARCACAO)
  })
})
