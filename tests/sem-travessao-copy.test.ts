import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { blogPosts } from '../data/blog-posts'
import { ibvPosts } from '../data/ibv-posts'
import { postsDoBlog, TAGS_BLOG } from '../data/blog-indice'

// Regra da casa: copy publica sem travessao (—). Em 16/out/2026 sairam os 144
// que restavam (96 nos posts do IBV, mais capitais, intros FIPE e estados).
// Este teste impede que voltem: todo o conteudo do blog e todo arquivo de
// dados em data/ (que e copy publica: pSEO, FAQ, posts).
describe('copy publica sem travessao', () => {
  it('conteudo do blog (posts, IBV Auto, tags)', () => {
    for (const p of blogPosts) expect(JSON.stringify(p), `/blog/${p.slug}`).not.toContain('—')
    for (const p of ibvPosts) expect(JSON.stringify(p), `/blog/${p.slug}`).not.toContain('—')
    expect(JSON.stringify(TAGS_BLOG)).not.toContain('—')
    expect(JSON.stringify(postsDoBlog)).not.toContain('—')
  })
  it('todo arquivo de dados em data/', () => {
    const dir = join(process.cwd(), 'data')
    for (const f of readdirSync(dir).filter((x) => /\.(ts|json)$/.test(x))) {
      const linhas = readFileSync(join(dir, f), 'utf8').split('\n')
      const com = linhas.map((l, i) => [i + 1, l] as const).filter(([, l]) => l.includes('—'))
      expect(com.map(([n, l]) => `${f}:${n}: ${l.trim().slice(0, 80)}`)).toEqual([])
    }
  })
})
