import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 19/11/2026: in Nuxt 3.21 a failed useFetch refresh() resets `data`, so the paid
// report turned into "Relatorio nao encontrado" and the DETRAN wait stopped polling.
// Background updates must keep the last good report when a request fails.
const fonte = readFileSync(resolve(__dirname, '../pages/premium/[token].vue'), 'utf8')
const script = fonte.slice(0, fonte.indexOf('<template>'))
const semComentarios = script.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('report page: background updates keep the last good report', () => {
  it('no longer calls the useFetch refresh(), which wipes data on failure', () => {
    expect(fonte).toContain("const { data, pending, error } = await useFetch<any>('/api/premium/report'")
    expect(semComentarios).not.toMatch(/\b(refresh|execute|refreshNuxtData|clearNuxtData)\s*\(/)
  })

  it('the update writes data only when the request succeeds', () => {
    expect(semComentarios).toMatch(/async function atualizarRelatorio\(\) \{\s*const meu = \+\+seqPedido\s*try \{\s*const r = await \$fetch<any>\('\/api\/premium\/report', \{ query: \{ token, o: origemAbertura \} \}\)\s*if \(r && meu > seqAplicado\) \{ seqAplicado = meu; data\.value = r \}\s*\} catch \{\s*\}\s*\}/)
  })

  it('an older (slow) response never overwrites a newer one already applied', () => {
    expect(semComentarios).toContain('let seqPedido = 0')
    expect(semComentarios).toContain('let seqAplicado = 0')
  })

  it('every poller (DETRAN, montadora, recall, multas, payment status) uses it', () => {
    const usos = semComentarios.match(/await atualizarRelatorio\(\)/g) || []
    expect(usos.length).toBe(8)
    expect(semComentarios).toMatch(/pollDetran = setInterval\(async \(\) => \{\s*await atualizarRelatorio\(\)/)
  })
})
