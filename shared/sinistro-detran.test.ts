import { describe, it, expect } from 'vitest'
import { sinistroPeloDetran, ehSinalSinistro, cartaoSinistro, TEXTO_SINISTRO_DETRAN, TEXTO_SINISTRO_NACIONAL, sinistroNaRestricaoNacional, ehRestricaoNacionalSinistro } from './sinistro-detran'

const bloco = (...restricoes_detran: { tipo: string; texto: string }[]) => ({ fonte: 'detran_xx', restricoes_detran })

describe('sinal de sinistro vindo do DETRAN', () => {
  it.each([
    ['SINISTRADO/RECUPERADO'],
    ['VEIC. DANO MEDIA MONTA'],
    ['Veículo com dano de grande monta'],
    ['INDICIO DE SINISTRO'],
    ['Indício de sinistro'],
    ['RESTRICAO DE SINISTRO'],
    ['SINISTRO'],
    ['Consta sinistro. Sem restrição financeira'],
    ['DMM'],
    ['PERDA TOTAL'],
  ])('acende: %s', (texto) => {
    expect(ehSinalSinistro({ tipo: 'administrativa', texto })).toBe(true)
    expect(sinistroPeloDetran(bloco({ tipo: 'administrativa', texto }))).toBe(true)
  })

  it.each([
    ['NADA CONSTA DE SINISTRO'],
    ['Sem sinistro'],
    ['SEM INDICIO DE SINISTRO'],
    ['Não consta sinistro'],
    ['Nao possui restricao de sinistro'],
    ['NENHUM SINISTRO REGISTRADO'],
    ['Sinistro: não'],
    ['SINISTRO: NADA CONSTA'],
    ['Inexistente registro de sinistro'],
    ['ALIENACAO FIDUCIARIA'],
    ['VEICULO RECUPERADO DE FURTO'],
    ['Este veículo não possui impedimentos e/ou restrições.'],
    [''],
  ])('nao acende: %s', (texto) => {
    expect(ehSinalSinistro({ tipo: 'administrativa', texto })).toBe(false)
    expect(sinistroPeloDetran(bloco({ tipo: 'administrativa', texto }))).toBe(false)
  })

  it('campo com tipo de sinistro: acende com valor afirmativo, nao com negativo', () => {
    expect(ehSinalSinistro({ tipo: 'indicio_sinistro', texto: 'SIM' })).toBe(true)
    expect(ehSinalSinistro({ tipo: 'sinistro', texto: 'CONSTA' })).toBe(true)
    expect(ehSinalSinistro({ tipo: 'sinistro', texto: 'NAO' })).toBe(false)
    expect(ehSinalSinistro({ tipo: 'sinistro', texto: 'Nada consta' })).toBe(false)
    expect(ehSinalSinistro({ tipo: 'sinistro', texto: '' })).toBe(false)
    expect(ehSinalSinistro({ tipo: 'sinistro', texto: '-' })).toBe(false)
  })

  it('basta um item com sinal no meio de outros', () => {
    expect(sinistroPeloDetran(bloco(
      { tipo: 'financeira', texto: 'ALIENACAO FIDUCIARIA' },
      { tipo: 'administrativa', texto: 'SINISTRADO/RECUPERADO' },
    ))).toBe(true)
  })

  it('revisor disse que o item so nega: nao acende', () => {
    const b = bloco({ tipo: 'administrativa', texto: 'SINISTRO' })
    expect(sinistroPeloDetran(b, { 'ADMINISTRATIVA|SINISTRO': { classe: 'nega' } })).toBe(false)
  })

  it('bloco ausente ou sem restricoes: nao acende', () => {
    expect(sinistroPeloDetran(null)).toBe(false)
    expect(sinistroPeloDetran(undefined)).toBe(false)
    expect(sinistroPeloDetran({ fonte: 'detran_sp' })).toBe(false)
    expect(sinistroPeloDetran({ restricoes_detran: null as any })).toBe(false)
  })
})

describe('cartao "Indício de sinistro" da grade', () => {
  it('nada consultado e nada do DETRAN: sem cartao', () => {
    expect(cartaoSinistro({ consultouParceira: false, parceiraIndicio: false, detran: false })).toBeNull()
  })

  it('base parceira consultada sem indicio e DETRAN sem sinal: verde, como antes', () => {
    const c = cartaoSinistro({ consultouParceira: true, parceiraIndicio: false, detran: false })!
    expect(c.ligado).toBe(false)
    expect(c.alerta).toBe(false)
    expect(c.rotuloVeredito).toBe('indício de sinistro em base parceira')
  })

  it('so a base parceira acusa: vermelho, rotulo da base parceira', () => {
    const c = cartaoSinistro({ consultouParceira: true, parceiraIndicio: true, detran: false })!
    expect(c).toMatchObject({ ligado: true, alerta: true, rotuloVeredito: 'indício de sinistro em base parceira' })
  })

  it('DETRAN acusa e a base parceira nao foi consultada: o cartao aparece vermelho', () => {
    const c = cartaoSinistro({ consultouParceira: false, parceiraIndicio: false, detran: true })!
    expect(c).toMatchObject({ k: 'sinistroDetran', label: 'Indício de sinistro', ligado: true, alerta: true })
    expect(c.rotuloVeredito).toBe('indício de sinistro informado pelo órgão de trânsito')
    expect(c.dica).toContain(TEXTO_SINISTRO_DETRAN)
  })

  it('caso real em forma sintetica: DETRAN-SP com dano de media monta e base parceira sem indicio', () => {
    const detran = sinistroPeloDetran({ fonte: 'detran_sp', restricoes_detran: [{ tipo: 'administrativa', texto: 'VEIC. DANO MEDIA MONTA' }] })
    expect(detran).toBe(true)
    expect(cartaoSinistro({ consultouParceira: true, parceiraIndicio: false, detran })).toMatchObject({ ligado: true, alerta: true })
  })

  it('DETRAN acusa e a base parceira disse nada consta: vermelho mesmo assim (caso do pedido)', () => {
    const c = cartaoSinistro({ consultouParceira: true, parceiraIndicio: false, detran: true })!
    expect(c).toMatchObject({ ligado: true, alerta: true, rotuloVeredito: 'indício de sinistro informado pelo órgão de trânsito' })
  })

  it('as duas fontes acusam: vermelho, cita as duas', () => {
    const c = cartaoSinistro({ consultouParceira: true, parceiraIndicio: true, detran: true })!
    expect(c.alerta).toBe(true)
    expect(c.rotuloVeredito).toBe('indício de sinistro informado pelo órgão de trânsito e em base parceira')
  })

  it('so a restricao nacional acusa, sem base parceira: cartao vermelho com texto proprio', () => {
    const c = cartaoSinistro({ consultouParceira: false, parceiraIndicio: false, detran: false, nacional: true })!
    expect(c).toMatchObject({ label: 'Indício de sinistro', ligado: true, alerta: true })
    expect(c.rotuloVeredito).toBe('indício de sinistro registrado em restrição oficial do veículo')
    expect(c.dica).toContain(TEXTO_SINISTRO_NACIONAL)
  })

  it('restricao nacional acusa e base parceira em nada consta: vermelho', () => {
    const c = cartaoSinistro({ consultouParceira: true, parceiraIndicio: false, detran: false, nacional: true })!
    expect(c).toMatchObject({ k: 'sinistroParceiro', ligado: true, alerta: true, rotuloVeredito: 'indício de sinistro registrado em restrição oficial do veículo' })
  })

  it('tres fontes acusam: rotulo lista todas', () => {
    const c = cartaoSinistro({ consultouParceira: true, parceiraIndicio: true, detran: true, nacional: true })!
    expect(c.rotuloVeredito).toBe('indício de sinistro informado pelo órgão de trânsito, registrado em restrição oficial do veículo e em base parceira')
  })

  it('copy sem travessao e sem nome de fornecedor', () => {
    const todos = [
      cartaoSinistro({ consultouParceira: false, parceiraIndicio: false, detran: false, nacional: true }),
      cartaoSinistro({ consultouParceira: true, parceiraIndicio: true, detran: true, nacional: true }),
      cartaoSinistro({ consultouParceira: true, parceiraIndicio: true, detran: true }),
      cartaoSinistro({ consultouParceira: false, parceiraIndicio: false, detran: true }),
    ]
    for (const c of todos) {
      const s = JSON.stringify(c)
      expect(s).not.toMatch(/[—–]/)
      expect(s.toLowerCase()).not.toMatch(/infosimples|senatran|serpro/)
    }
  })
})

describe('sinistro na restricao nacional (restricoesItens)', () => {
  it.each(['RECUPERADO_SINISTRO', 'SINISTRO', 'SINISTRO_MEDIA_MONTA', 'SINISTRO_PEQUENA_MONTA', 'SINISTRO_GRANDE_MONTA', 'Recuperado de sinistro', 'DANO_GRANDE_MONTA'])('acende: %s', (item) => {
    expect(ehRestricaoNacionalSinistro(item)).toBe(true)
    expect(sinistroNaRestricaoNacional(['ALIENACAO_FIDUCIARIA', item])).toBe(true)
  })

  it.each(['SEM_SINISTRO', 'NADA_CONSTA_SINISTRO', 'NAO_CONSTA_SINISTRO', 'ALIENACAO_FIDUCIARIA', 'RECUPERADO_FURTO', 'ROUBO', ''])('nao acende: %s', (item) => {
    expect(ehRestricaoNacionalSinistro(item)).toBe(false)
  })

  it('lista ausente ou vazia: nao acende', () => {
    expect(sinistroNaRestricaoNacional(null)).toBe(false)
    expect(sinistroNaRestricaoNacional(undefined)).toBe(false)
    expect(sinistroNaRestricaoNacional([])).toBe(false)
  })
})
