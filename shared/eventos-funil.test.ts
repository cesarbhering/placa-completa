import { describe, it, expect } from 'vitest'
import { sanearEvento, sanearLote, eventoPermitido, EVENTOS_FUNIL, MAX_EVENTOS_POR_LOTE } from './eventos-funil'

describe('allowlist do funil', () => {
  it('so os nomes do contrato entram', () => {
    for (const nome of EVENTOS_FUNIL) expect(eventoPermitido(nome)).toBe(true)
    for (const fora of ['purchase', 'form_start', 'drop table', '', null, 42]) {
      expect(eventoPermitido(fora as any)).toBe(false)
    }
  })

  it('evento fora da lista nao vira linha', () => {
    expect(sanearEvento({ evento: 'qualquer_coisa', placa: 'ABC1D23' })).toBeNull()
  })
})

describe('saneamento do evento', () => {
  it('normaliza placa e descarta placa incompleta', () => {
    expect(sanearEvento({ evento: 'resultado_exibido', placa: 'abc-1d23' })!.placa).toBe('ABC1D23')
    expect(sanearEvento({ evento: 'resultado_exibido', placa: 'ABC1' })!.placa).toBeNull()
  })

  it('sinal de leilao invalido cai em sem_sinal', () => {
    expect(sanearEvento({ evento: 'cta_completa_visto', leilao_sinal: 'talvez' })!.leilao_sinal).toBe('sem_sinal')
    expect(sanearEvento({ evento: 'cta_completa_visto', leilao_sinal: 'positivo' })!.leilao_sinal).toBe('positivo')
  })

  it('plano so aceita os planos pagos reais', () => {
    expect(sanearEvento({ evento: 'pix_gerado', plano: 'completa' })!.plano).toBe('completa')
    expect(sanearEvento({ evento: 'pix_gerado', plano: 'premium_ouro' })!.plano).toBeNull()
  })

  it('origem guarda so os campos conhecidos', () => {
    const o = sanearEvento({ evento: 'resultado_exibido', origem: { msclkid: 'x1', lixo: 'y', utm_source: 'bing' } })!
    expect(o.origem).toEqual({ gclid: null, msclkid: 'x1', utm_source: 'bing', utm_medium: null, utm_campaign: null })
  })
})

describe('sem PII', () => {
  it('extra descarta e-mail, telefone, ip, chassi, token e user agent', () => {
    const o = sanearEvento({
      evento: 'email_informado',
      extra: { email: 'a@b.com', telefone: '11999', ip: '1.2.3.4', chassi: '9BW', token: 'tok', user_agent: 'Mozilla', onde: 'checkout' },
    })!
    expect(o.extra).toEqual({ onde: 'checkout' })
  })

  it('extra aceita so escalares e no maximo 8 chaves', () => {
    const extra: Record<string, unknown> = { obj: { a: 1 }, arr: [1], nulo: null }
    for (let i = 0; i < 12; i++) extra['k' + i] = i
    const o = sanearEvento({ evento: 'resultado_exibido', extra })!
    expect(Object.keys(o.extra!).length).toBe(8)
    expect(o.extra!.obj).toBeUndefined()
    expect(o.extra!.arr).toBeUndefined()
  })

  it('nenhum campo de pessoa sobrevive no nivel de cima', () => {
    const o = sanearEvento({ evento: 'pix_gerado', email: 'a@b.com', ip: '1.2.3.4', user_agent: 'Mozilla' }) as any
    expect(o.email).toBeUndefined()
    expect(o.ip).toBeUndefined()
    expect(o.user_agent).toBeUndefined()
    expect(Object.keys(o).sort()).toEqual(['evento', 'extra', 'leilao_sinal', 'origem', 'placa', 'plano', 'recall_marca', 'recall_sinal', 'sessao'])
  })
})

describe('lote', () => {
  it('respeita o teto de eventos por requisicao', () => {
    const eventos = Array.from({ length: 25 }, () => ({ evento: 'resultado_exibido' }))
    expect(sanearLote({ eventos }).length).toBe(MAX_EVENTOS_POR_LOTE)
  })

  it('aceita array cru ou { eventos }', () => {
    expect(sanearLote([{ evento: 'pix_gerado' }]).length).toBe(1)
    expect(sanearLote({ eventos: [{ evento: 'pix_gerado' }] }).length).toBe(1)
  })

  it('corpo invalido vira lote vazio em vez de erro', () => {
    for (const lixo of [null, undefined, 'texto', 42, {}]) expect(sanearLote(lixo)).toEqual([])
  })

  it('descarta os invalidos e mantem os validos do mesmo lote', () => {
    const lote = sanearLote([{ evento: 'resultado_exibido' }, { evento: 'hack' }, { evento: 'cta_completa_click' }])
    expect(lote.map(e => e.evento)).toEqual(['resultado_exibido', 'cta_completa_click'])
  })
})

import { sanearSinalRecall, sanearMarcaRecall } from './eventos-funil'
describe('recall_sinal / recall_marca', () => {
  it('allowlist do sinal de recall', () => {
    for (const v of ['firme', 'suave', 'negativo', 'fora_escopo', 'sem_sinal']) expect(sanearSinalRecall(v)).toBe(v)
    expect(sanearSinalRecall('talvez')).toBeNull()
    expect(sanearSinalRecall(undefined)).toBeNull()
  })
  it('marca: so letras, maiusculas, ate 30', () => {
    expect(sanearMarcaRecall('nissan')).toBe('NISSAN')
    expect(sanearMarcaRecall('<script>x')).toBe('SCRIPTX')
    expect(sanearMarcaRecall('A'.repeat(50))).toHaveLength(30)
    expect(sanearMarcaRecall(12)).toBeNull()
  })
  it('vai no evento saneado (e evento sem o campo fica null)', () => {
    const e = sanearEvento({ evento: 'pix_gerado', recall_sinal: 'firme', recall_marca: 'honda' })!
    expect(e.recall_sinal).toBe('firme')
    expect(e.recall_marca).toBe('HONDA')
    const v = sanearEvento({ evento: 'pix_gerado' })!
    expect(v.recall_sinal).toBeNull()
    expect(v.recall_marca).toBeNull()
  })
  it('recall_sinal_visto esta na allowlist', () => {
    expect(sanearEvento({ evento: 'recall_sinal_visto' })).not.toBeNull()
  })
})
