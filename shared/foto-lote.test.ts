import { describe, expect, it } from 'vitest'
import { fotoRefsDaPassagem, urlFotoLote, fotoRefDoRelatorio, altFotoLote } from './foto-lote'

const REF = (n: number) => `ref${n}.abcdefABCDEF0123456789`
const passagem = { nivel: 'possivel', detalhes: { fotos: [
  { ordem: 3, vista: 'traseira', url_origem: 'https://cdn.exemplo/3.jpg', foto_ref: REF(3) },
  { ordem: 1, vista: 'frente', url_origem: 'https://cdn.exemplo/1.jpg', foto_ref: REF(1) },
  { ordem: 2, vista: null, url_origem: 'https://cdn.exemplo/2.jpg', foto_ref: REF(2) },
  { ordem: 4, vista: 'painel', foto_ref: REF(4) },
  { ordem: 5, vista: 'lateral', foto_ref: REF(5) },
  { ordem: 6, vista: 'x', foto_ref: 'tem espaco e <script>' },
] } }

describe('fotos do lote por referencia (R2)', () => {
  it('ate 4, por ordem, ref so com caracteres de token, vista conhecida', () => {
    expect(fotoRefsDaPassagem(passagem)).toEqual([
      { ref: REF(1), ordem: 1, vista: 'frente' },
      { ref: REF(2), ordem: 2, vista: null },
      { ref: REF(3), ordem: 3, vista: 'traseira' },
      { ref: REF(4), ordem: 4, vista: 'painel' },
    ])
    expect(fotoRefsDaPassagem({})).toEqual([])
  })
  it('url pela nossa rota, nunca a assinada nem a da casa', () => {
    expect(urlFotoLote('TokFicticio000000000001', REF(1))).toBe(`/api/premium/foto?token=TokFicticio000000000001&ref=${REF(1)}`)
  })
  it('ref so vale se for deste relatorio', () => {
    const snap = { historicoLeilao: { passagens: [{ foto_refs: fotoRefsDaPassagem(passagem) }] } }
    expect(fotoRefDoRelatorio(snap, REF(2))).toBe(true)
    expect(fotoRefDoRelatorio(snap, REF(5))).toBe(false)
    expect(fotoRefDoRelatorio({ historicoLeilao: { passagens: [passagem] } }, REF(1))).toBe(true) // snapshot sem foto_refs saneado
    expect(fotoRefDoRelatorio(null, REF(1))).toBe(false)
  })
  it('alt pela vista', () => {
    expect(altFotoLote('frente', 0)).toBe('Foto da frente do lote de leilão com perfil parecido')
    expect(altFotoLote('painel', 0)).toBe('Foto do painel do lote de leilão com perfil parecido')
    expect(altFotoLote(null, 1)).toBe('Foto 2 do lote de leilão com perfil parecido')
  })
  it('sanearHistorico guarda os refs (e o filtro LGPD nao os altera)', async () => {
    const { sanearHistorico } = await import('../server/utils/historico-leilao')
    const h = sanearHistorico({ resumo: {}, passagens: [{ ...passagem, fonte: 'superbid', fonte_tipo: 'privado' }] })!
    expect(h.passagens[0].foto_refs!.map((f) => f.ref)).toEqual([REF(1), REF(2), REF(3), REF(4)])
  })
})

describe('rota /api/premium/foto', () => {
  it('cache por token + ref (nunca so pelo ref)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'server/api/premium/foto.get.ts'), 'utf8')
    expect(src).toContain('const chave = `${tok}|${r}`')
    expect(src).not.toMatch(/cache\.(get|set)\(r[,)]/)
    expect(src.indexOf('fotoRefDoRelatorio(')).toBeGreaterThan(0)
  })
})
