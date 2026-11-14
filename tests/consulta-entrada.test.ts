import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function arquivos(dir: string): string[] {
  const out: string[] = []
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) out.push(...arquivos(p))
    else if (p.endsWith('.vue')) out.push(p)
  }
  return out
}

describe('free lookup callers send the entry page', () => {
  it('every page or component that posts /api/consulta also sends entradaDaSessao()', () => {
    const chamam = [...arquivos('pages'), ...arquivos('components')]
      .filter((f) => /\$fetch\b[^(]*\(\s*['"]\/api\/consulta['"]/.test(readFileSync(f, 'utf8')))   // with or without a type argument
    expect(chamam.length).toBeGreaterThan(1)
    const semEntrada = chamam.filter((f) => !/entrada:\s*entradaDaSessao\(\)/.test(readFileSync(f, 'utf8')))
    expect(semEntrada).toEqual([])
  })
})
