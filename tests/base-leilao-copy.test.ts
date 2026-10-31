import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { BASE_LEILAO_TEXTO, BASE_LEILAO_TEXTO_INICIO, BASE_LEILAO_QTD } from '../shared/base-leilao'
import { leilaoSemOcorrencia } from '../shared/leilao-copy'

// Decisao do Cesar (07/out): base de leilao = "mais de 2 milhoes de registros
// de leilao" (2.336.917 registros, 1.876.811 veiculos distintos). Nunca
// "2 milhoes de veiculos".
// Excecao aprovada pelo Cesar (31/out): o indicio de leilao do checkout B fala
// em veiculos leiloados, nao em registros. So esta frase exata passa.
const FRASES_APROVADAS = ['base de mais de 1 milhão de veículos leiloados']

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
      for (const ok of FRASES_APROVADAS) s = s.split(ok).join('')
      if (/1 milh[aã]o de (ve[ií]culos|registros)|base de 1 milh|milh[oõ]es de ve[ií]culos leiloados|2 milh[oõ]es de ve[ií]culos/i.test(s)) ruins.push(f)
    }
    expect(ruins).toEqual([])
  })
  it('a excecao aprovada nao abre brecha para variacoes', () => {
    const ruim = /1 milh[aã]o de (ve[ií]culos|registros)|base de 1 milh|milh[oõ]es de ve[ií]culos leiloados|2 milh[oõ]es de ve[ií]culos/i
    const limpa = (t: string) => FRASES_APROVADAS.reduce((acc, ok) => acc.split(ok).join(''), t)
    expect(ruim.test(limpa('Indício de leilão (base de mais de 1 milhão de veículos leiloados)'))).toBe(false)
    expect(ruim.test(limpa('base de 1 milhão de veículos'))).toBe(true)
    expect(ruim.test(limpa('mais de 1 milhão de registros de leilão'))).toBe(true)
  })
})
