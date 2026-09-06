import { describe, it, expect } from 'vitest'
import { detectarSegmento, nomeDoVeiculo, artigoDoVeiculo, aceitaCustoDeCarro } from './segmento'

// Fixtures reais de producao.
const PCX = {
  wdapi: { segmento: 'Moto', MODELO: 'PCX 150 DLX ABS', extra: { tipo_veiculo: 'Motoneta' } },
  senatran: { descricaoMarcaModelo: 'HONDA/PCX 150 DLX ABS', cilindrada: 149, descricaoTipoVeiculo: 'MOTONETA' },
  chassi: '9C2KF2210LR000001',
}
const YBR = {
  wdapi: { MODELO: 'YBR 125 K' },
  senatran: { descricaoMarcaModelo: 'YAMAHA/YBR 125 K', cilindrada: 124, descricaoTipoVeiculo: 'MOTOCICLETA' },
  chassi: '9C6KE013010002323',
}
const FAZER = {
  wdapi: { MODELO: 'FAZER YS250' },
  senatran: { descricaoMarcaModelo: 'YAMAHA/FAZER YS250', cilindrada: 249 },
  chassi: null,
}
const GOL = {
  wdapi: { MODELO: 'NOVO GOL TL MCV', segmento: 'Carro' },
  senatran: { descricaoMarcaModelo: 'VW/NOVO GOL TL MCV', cilindrada: 1000, descricaoTipoVeiculo: 'AUTOMOVEL' },
  chassi: '9BWAG45UXJT036030',
}

describe('detectarSegmento', () => {
  it('reconhece moto pelo tipo declarado', () => {
    expect(detectarSegmento(PCX)).toBe('moto')
    expect(detectarSegmento(YBR)).toBe('moto')
  })

  it('reconhece moto pela cilindrada quando o tipo nao vem', () => {
    expect(detectarSegmento(FAZER)).toBe('moto')
  })

  it('reconhece moto pelo WMI do chassi', () => {
    expect(detectarSegmento({ chassi: '9C2KF2210LR000001' })).toBe('moto')
    expect(detectarSegmento({ chassi: '9C6KE013010002323' })).toBe('moto')
  })

  it('carro popular 1.0 nao vira moto por causa da cilindrada', () => {
    expect(detectarSegmento(GOL)).toBe('carro')
    expect(detectarSegmento({ senatran: { descricaoMarcaModelo: 'FIAT/UNO MILLE 1.0', cilindrada: 999 } })).toBe('carro')
  })

  it('caminhao e onibus tem segmento proprio', () => {
    expect(detectarSegmento({ senatran: { descricaoTipoVeiculo: 'CAMINHAO' } })).toBe('caminhao')
    expect(detectarSegmento({ senatran: { descricaoEspecie: 'ONIBUS' } })).toBe('caminhao')
  })

  it('sem sinal nenhum nao chuta', () => {
    expect(detectarSegmento({})).toBe('outro')
  })
})

describe('copy por segmento', () => {
  it('da o nome certo pro veiculo', () => {
    expect(nomeDoVeiculo('moto')).toBe('moto')
    expect(nomeDoVeiculo('carro')).toBe('carro')
    expect(nomeDoVeiculo('caminhao')).toBe('caminhão')
    expect(nomeDoVeiculo('outro')).toBe('veículo')
  })

  it('concorda o artigo', () => {
    expect(`${artigoDoVeiculo('moto')} ${nomeDoVeiculo('moto')}`).toBe('esta moto')
    expect(`${artigoDoVeiculo('carro')} ${nomeDoVeiculo('carro')}`).toBe('este carro')
  })
})

describe('aceitaCustoDeCarro', () => {
  it('so carro aceita a conta de custo de carro', () => {
    expect(aceitaCustoDeCarro('carro')).toBe(true)
    expect(aceitaCustoDeCarro('moto')).toBe(false)
    expect(aceitaCustoDeCarro('caminhao')).toBe(false)
    expect(aceitaCustoDeCarro('outro')).toBe(false)
  })
})
