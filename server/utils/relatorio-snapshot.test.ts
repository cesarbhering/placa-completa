import { describe, it, expect } from 'vitest'
import { refinoConfiavelEConsistente } from './relatorio-snapshot'

// Guard do refino da Camada 2 (incidente OBPyTouAGB, 23/set): o refino so pode
// sobrescrever a FIPE ambigua quando a re-resolucao decidiu com confianca de
// verdade E na versao coerente com o cambio do recall. Fallback (FIPE-api fora)
// ou cambio oposto = recusa, mantem o ambiguo honesto.

const regra = (modelo: string) => ({
  fipeModelo: modelo,
  fipe: 'R$ 41.349,00',
  fipeCandidato: { decididoPor: 'regra', confianca: 'alta', candidatos: [{ codigo_fipe: '001361-7', modelo, valor: 41349 }] },
})

describe('refinoConfiavelEConsistente', () => {
  it('ACEITA regra + versao Mec. quando o recall diz manual', () => {
    expect(refinoConfiavelEConsistente(regra('500 Cult 1.4 Flex 8V EVO Mec.'), 'manual')).toBe(true)
  })

  it('ACEITA regra + versao Aut. quando o recall diz automatico', () => {
    expect(refinoConfiavelEConsistente(regra('Corolla 2.0 Aut.'), 'automatico')).toBe(true)
  })

  it('RECUSA quando escolheu o cambio OPOSTO (manual pedido, veio Dualogic/automatica)', () => {
    expect(refinoConfiavelEConsistente(regra('500 Cult 1.4 Flex 8V EVO Dualogic'), 'manual')).toBe(false)
  })

  it('RECUSA o caso do incidente: degradou pro fallback (fipeCandidato=null) e cravaria Dualogic', () => {
    const degradado = { fipeModelo: '500 Cult 1.4 Flex 8V EVO Dualogic', fipe: 'R$ 42.423,00', fipeCandidato: null }
    expect(refinoConfiavelEConsistente(degradado, 'manual')).toBe(false)
  })

  it('RECUSA decididoPor=fallback', () => {
    const fb = { fipeModelo: '500 Cult 1.4 Flex 8V EVO Mec.', fipeCandidato: { decididoPor: 'fallback', candidatos: [] } }
    expect(refinoConfiavelEConsistente(fb, 'manual')).toBe(false)
  })

  it('RECUSA decididoPor=ambiguo (nao decidiu)', () => {
    const amb = { fipeModelo: '500 Cult 1.4 Flex 8V EVO Mec.', fipeCandidato: { decididoPor: 'ambiguo', candidatos: [{ modelo: 'a' }, { modelo: 'b' }] } }
    expect(refinoConfiavelEConsistente(amb, 'manual')).toBe(false)
  })

  it('RECUSA quando nao ha candidatos, mesmo com decididoPor confiante', () => {
    const vazio = { fipeModelo: '500 Cult 1.4 Flex 8V EVO Mec.', fipeCandidato: { decididoPor: 'regra', candidatos: [] } }
    expect(refinoConfiavelEConsistente(vazio, 'manual')).toBe(false)
  })

  it('ACEITA decididoPor=haiku confiante e coerente', () => {
    const haiku = { fipeModelo: 'Onix 1.0 Turbo Mec.', fipeCandidato: { decididoPor: 'haiku', confianca: 'alta', candidatos: [{ modelo: 'Onix 1.0 Turbo Mec.' }] } }
    expect(refinoConfiavelEConsistente(haiku, 'manual')).toBe(true)
  })

  it('ACEITA decididoPor=wdapi confiante e coerente com o cambio', () => {
    const wd = { fipeModelo: 'Onix 1.0 Mec.', fipeCandidato: { decididoPor: 'wdapi', confianca: 'alta', candidatos: [{ modelo: 'Onix 1.0 Mec.' }] } }
    expect(refinoConfiavelEConsistente(wd, 'manual')).toBe(true)
  })

  it('RECUSA wdapi quando a versao NAO bate com o cambio do recall', () => {
    const wd = { fipeModelo: 'Onix 1.0 Aut.', fipeCandidato: { decididoPor: 'wdapi', confianca: 'alta', candidatos: [{ modelo: 'Onix 1.0 Aut.' }] } }
    expect(refinoConfiavelEConsistente(wd, 'manual')).toBe(false)
  })

  it('RECUSA valorCusto nulo/sem fipeModelo', () => {
    expect(refinoConfiavelEConsistente(null, 'manual')).toBe(false)
    expect(refinoConfiavelEConsistente({ fipeCandidato: { decididoPor: 'regra', candidatos: [{}] } }, 'manual')).toBe(false)
  })
})
