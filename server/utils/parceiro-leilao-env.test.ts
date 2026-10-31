import { describe, it, expect } from 'vitest'
import { cfgParceiro } from './parceiro-leilao'
import { envLegadaParceiro } from './parceiro-leilao-env'

// Migracao de nome das envs: o nome novo (runtimeConfig) manda; vazio, vale a
// env de nome legado, pra producao nao desligar a fonte no meio da troca.
describe('config da base parceira com env legada', () => {
  it('sem nada configurado: desligada, teto 40', () => {
    const c = cfgParceiro({}, {})
    expect(c.ligado).toBe(false)
    expect(c.tetoDia).toBe(40)
    expect(c.usuario).toBe('')
  })

  it('nome novo tem prioridade', () => {
    const c = cfgParceiro({ parceiroLeilaoLigado: 'on', parceiroLeilaoUser: 'novo', parceiroLeilaoTetoDia: '10', parceiroLeilaoUrl: 'https://x.test/' }, {})
    expect(c).toMatchObject({ ligado: true, usuario: 'novo', tetoDia: 10, base: 'https://x.test' })
  })

  it('nome novo vazio cai na env legada', () => {
    const env: Record<string, string> = {}
    for (const [campo, valor] of [['LIGADO', 'on'], ['USER', 'antigo'], ['PASS', 's'], ['TETO_DIA', '7']] as const) {
      // descobre o nome legado pela propria funcao, sem repetir o nome aqui
      const probe: Record<string, string> = new Proxy({}, { get: (_t, k) => { env[String(k)] = valor; return valor } })
      envLegadaParceiro(campo, probe)
    }
    const c = cfgParceiro({ parceiroLeilaoUser: '' }, env)
    expect(c).toMatchObject({ ligado: true, usuario: 'antigo', senha: 's', tetoDia: 7 })
  })
})
