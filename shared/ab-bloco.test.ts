import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AB_BLOCO_KEY, decidirVariante, varianteAtual, fipeSemCentavos,
  tituloVarianteB, subVarianteB, garantiaVarianteB, TITULO_PADRAO,
} from './ab-bloco'

function comSessionStorage(inicial?: string, quebrado = false) {
  const store = new Map<string, string>()
  if (inicial) store.set(AB_BLOCO_KEY, inicial)
  const fake = quebrado
    ? { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') }, removeItem: () => {} }
    : {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
      }
  vi.stubGlobal('sessionStorage', fake)
  return store
}

describe('sorteio e persistencia da variante', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('sorteia 50/50: metade baixa vira A, metade alta vira A2', () => {
    comSessionStorage()
    expect(decidirVariante({ rnd: () => 0.1 })).toBe('A')
    vi.unstubAllGlobals()
    comSessionStorage()
    expect(decidirVariante({ rnd: () => 0.9 })).toBe('A2')
  })

  it('decide UMA vez por visita: a segunda chamada reusa o que foi guardado', () => {
    const store = comSessionStorage()
    expect(decidirVariante({ rnd: () => 0.9 })).toBe('A2')
    expect(store.get(AB_BLOCO_KEY)).toBe('A2')
    // Sorteio que diria A na segunda chamada nao pode trocar a tela no meio
    // da visita: seria contar a mesma pessoa nas duas variantes.
    expect(decidirVariante({ rnd: () => 0.1 })).toBe('A2')
  })

  it('kill switch joga todo mundo em A e nao carimba nada', () => {
    const store = comSessionStorage()
    expect(decidirVariante({ desligado: true, rnd: () => 0.9 })).toBe('A')
    expect(store.has(AB_BLOCO_KEY)).toBe(false)
  })

  it('rodada 3: quem tinha B guardado e re-sorteado entre A e A2', () => {
    const store = comSessionStorage('B')
    expect(varianteAtual()).toBeNull()
    expect(decidirVariante({ rnd: () => 0.9 })).toBe('A2')
    expect(store.get(AB_BLOCO_KEY)).toBe('A2')
    vi.unstubAllGlobals()
    comSessionStorage('B')
    expect(decidirVariante({ rnd: () => 0.1 })).toBe('A')
  })

  it('valor estranho no storage e ignorado e vira sorteio novo', () => {
    comSessionStorage('Z')
    expect(decidirVariante({ rnd: () => 0.9 })).toBe('A2')
  })

  it('storage bloqueado (modo privado) nao quebra: decide e segue', () => {
    comSessionStorage(undefined, true)
    expect(decidirVariante({ rnd: () => 0.9 })).toBe('A2')
    expect(varianteAtual()).toBeNull()
  })

  it('varianteAtual nao sorteia nada: antes da decisao devolve null', () => {
    comSessionStorage()
    expect(varianteAtual()).toBeNull()
  })
})

describe('copy da variante B sem os dados do veiculo', () => {
  it('usa marca, modelo e ano quando os tres existem', () => {
    expect(tituloVarianteB('Fiat', 'Uno', 2015))
      .toBe('Este Fiat Uno 2015 pode ter restrição, gravame ou dívida.')
  })

  it('faltando qualquer um dos tres, cai no titulo de hoje', () => {
    expect(tituloVarianteB('Fiat', 'Uno', null)).toBe(TITULO_PADRAO)
    expect(tituloVarianteB(null, 'Uno', 2015)).toBe(TITULO_PADRAO)
    expect(tituloVarianteB('Fiat', '-', 2015)).toBe(TITULO_PADRAO)
    expect(tituloVarianteB('Fiat', '  ', 2015)).toBe(TITULO_PADRAO)
  })

  it('tira os centavos do valor FIPE', () => {
    expect(fipeSemCentavos('R$ 113.297,00')).toBe('113.297')
    expect(fipeSemCentavos('R$ 8.900,00')).toBe('8.900')
  })

  it('sem FIPE nao inventa preco: devolve null', () => {
    expect(fipeSemCentavos(null)).toBeNull()
    expect(fipeSemCentavos('-')).toBeNull()
    expect(fipeSemCentavos('')).toBeNull()
  })

  it('a sub cita o preco do carro quando ha FIPE', () => {
    expect(subVarianteB('113.297', 12)).toContain('Antes de pagar R$ 113.297 por ele')
    expect(subVarianteB('113.297', 12)).toContain('mais 12 verificações')
  })

  it('sem FIPE a oracao do preco some inteira, sem "R$ -"', () => {
    const sub = subVarianteB(null, 12)
    expect(sub).not.toContain('R$')
    expect(sub.startsWith('Veja se pode confiar neste carro:')).toBe(true)
  })

  it('a linha de baixo tem Pix na web e nao tem no app', () => {
    expect(garantiaVarianteB('R$ 39,90')).toBe('R$ 39,90 · Pix · em até 5 minutos · estorno se o veículo não for encontrado')
    expect(garantiaVarianteB('R$ 39,90', true)).not.toContain('Pix')
  })
})
