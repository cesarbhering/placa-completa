import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Regressao de 22/set/2026: a variante era sorteada DEPOIS de
// `resultado_exibido`, entao o primeiro evento do funil saia sem `ab_bloco` e
// a view funil_diario jogava toda a base de resultado em 'sem_ab' (270 no dia
// 21, 25 na madrugada do 22). Sem o resultado por variante nao existe taxa
// consulta->checkout por variante, que e a leitura que decide o teste.
//
// O teste e de ordem no fonte porque o bug e de ordem: montar a pagina
// inteira no vitest custaria muito mais pra provar a mesma linha.
describe('ordem do sorteio da variante A/B na consulta gratis', () => {
  const fonte = readFileSync(resolve(__dirname, '../pages/index.vue'), 'utf8')

  it('decide a variante antes de enfileirar resultado_exibido', () => {
    const sorteio = fonte.indexOf('abBloco.value = decidirVariante(')
    const resultado = fonte.indexOf("enfileirarEventoFunil('resultado_exibido'")
    expect(sorteio).toBeGreaterThan(-1)
    expect(resultado).toBeGreaterThan(-1)
    expect(sorteio).toBeLessThan(resultado)
  })

  it('sorteia a variante uma unica vez na pagina', () => {
    const ocorrencias = fonte.match(/abBloco\.value = decidirVariante\(/g) || []
    expect(ocorrencias).toHaveLength(1)
  })
})
