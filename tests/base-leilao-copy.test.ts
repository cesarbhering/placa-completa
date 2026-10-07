import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { BASE_LEILAO_TEXTO, BASE_LEILAO_TEXTO_INICIO, BASE_LEILAO_QTD } from '../shared/base-leilao'
import { leilaoSemOcorrencia } from '../shared/leilao-copy'

// Decisao do Cesar (07/out): base de leilao = "mais de 2 milhoes de registros
// de leilao" (2.336.917 registros, 1.876.811 veiculos distintos). Nunca
// "2 milhoes de veiculos".
describe('copy da base de leilao', () => {
  it('constante', () => {
    expect(BASE_LEILAO_TEXTO).toBe('mais de 2 milhões de registros de leilão')
    expect(BASE_LEILAO_TEXTO_INICIO).toBe('Mais de 2 milhões de registros de leilão')
    expect(BASE_LEILAO_QTD).toBe('mais de 2 milhões')
  })
  it('frase pronta', () => {
    expect(leilaoSemOcorrencia('este veículo')).toMatch(/^Na nossa base com mais de 2 milhões de registros de leilão, nenhuma ocorrência/)
  })
  it('nenhum "1 milhão" nem "milhões de veículos" de leilão no site (fora data/capitals.ts)', () => {
    const arquivos = execSync("git ls-files '*.ts' '*.vue' '*.txt' '*.md'", { encoding: 'utf8' }).split('\n')
      .filter((f) => f && !f.startsWith('data/capitals.ts') && !f.startsWith('tests/') && !f.startsWith('docs/') && !f.endsWith('.test.ts') && !f.startsWith('reports/'))
    const ruins: string[] = []
    for (const f of arquivos) {
      let s = ''
      try { s = readFileSync(f, 'utf8') } catch { continue }
      if (/1 milh[aã]o de (ve[ií]culos|registros)|base de 1 milh|milh[oõ]es de ve[ií]culos leiloados|2 milh[oõ]es de ve[ií]culos/i.test(s)) ruins.push(f)
    }
    expect(ruins).toEqual([])
  })
})
