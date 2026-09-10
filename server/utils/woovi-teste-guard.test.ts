import { describe, it, expect, vi } from 'vitest'

// Esta pagina cria cobranca de verdade e mostra a resposta crua do adquirente.
// A regra de quem pode ve-la e curta de proposito, e este teste existe pra que
// ela continue curta: qualquer combinacao que nao seja homolog COM woovi e 404.
const config: any = { public: { homolog: false }, pixProvider: 'abacatepay' }
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.message || o.statusMessage), o))

const { testeWooviLiberado, exigirTesteWooviLiberado } = await import('./woovi-teste-guard')

function cenario(homolog: boolean, provedor: string) {
  config.public.homolog = homolog
  config.pixProvider = provedor
}

describe('quem pode ver a pagina de teste da Woovi', () => {
  it('homolog com woovi: pode', () => {
    cenario(true, 'woovi')
    expect(testeWooviLiberado()).toBe(true)
  })

  it('producao com woovi: NAO pode, mesmo com o provedor ligado', () => {
    cenario(false, 'woovi')
    expect(testeWooviLiberado()).toBe(false)
  })

  it('homolog sem woovi: nao pode', () => {
    cenario(true, 'abacatepay')
    expect(testeWooviLiberado()).toBe(false)
  })

  it('producao com abacatepay: nao pode', () => {
    cenario(false, 'abacatepay')
    expect(testeWooviLiberado()).toBe(false)
  })

  it('bloqueio e 404, nao 403: quem nao pode nem descobre que a rota existe', () => {
    cenario(false, 'woovi')
    expect(() => exigirTesteWooviLiberado()).toThrowError(expect.objectContaining({ statusCode: 404 }))
  })

  it('liberado nao lanca', () => {
    cenario(true, 'woovi')
    expect(() => exigirTesteWooviLiberado()).not.toThrow()
  })
})
