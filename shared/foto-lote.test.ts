import { describe, expect, it } from 'vitest'
import { fotoRefsDaPassagem, urlFotoLote, fotoRefDoRelatorio, altFotoLote, fotosPendentes, passagemPrecisaDeFoto } from './foto-lote'

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

describe('teto de fotos por relatorio', () => {
  it('40 chamadas novas por hora por token; janela nova libera', async () => {
    const { dentroDoTetoDeFoto, _limparTetoDeEdital, TETO_FOTO_POR_TOKEN } = await import('../server/utils/edital-leilao')
    _limparTetoDeEdital()
    const t0 = 1_000_000
    for (let i = 0; i < TETO_FOTO_POR_TOKEN; i++) expect(dentroDoTetoDeFoto('tokA', t0)).toBe(true)
    expect(dentroDoTetoDeFoto('tokA', t0)).toBe(false)
    expect(dentroDoTetoDeFoto('tokB', t0)).toBe(true)
    expect(dentroDoTetoDeFoto('tokA', t0 + 60 * 60 * 1000)).toBe(true)
  })
})

describe('fotos que chegam depois da venda', () => {
  const base = { nivel: 'possivel', fonte: 'copart', fonte_tipo: 'privado', lote: '1', detalhes: { fotos_pendente: true }, foto_refs: [], fotos: [] }

  it('aviso "Buscando fotos" so enquanto pendente e sem foto', () => {
    expect(fotosPendentes(base)).toBe(true)
    expect(fotosPendentes({ ...base, fotos_pendente: true })).toBe(true)
    expect(fotosPendentes({ ...base, detalhes: {} })).toBe(false)
    expect(fotosPendentes({ ...base, foto_refs: [{ ref: REF(1), ordem: 1, vista: null }] })).toBe(false)
    expect(fotosPendentes({ ...base, fotos_busca: { status: 'sem_foto', em: 'x' } })).toBe(false)
    expect(fotosPendentes({ ...base, fotos_pendente: false })).toBe(false)
    expect(fotosPendentes(null)).toBe(false)
  })

  it('aviso some sozinho 7 dias depois da entrega (so exibicao)', () => {
    const agora = Date.parse('2026-10-18T12:00:00Z')
    const dia = 24 * 60 * 60 * 1000
    expect(fotosPendentes(base, { entregueEm: new Date(agora - 6 * dia).toISOString(), agora })).toBe(true)
    expect(fotosPendentes(base, { entregueEm: new Date(agora - 8 * dia).toISOString(), agora })).toBe(false)
    expect(fotosPendentes(base, { entregueEm: null, agora })).toBe(true)
  })

  it('job pergunta por casa privada ou passagem pendente; nunca por notificacao', () => {
    expect(passagemPrecisaDeFoto(base)).toBe(true)
    expect(passagemPrecisaDeFoto({ ...base, detalhes: {} })).toBe(true)
    expect(passagemPrecisaDeFoto({ ...base, fonte: 'detran_mg', fonte_tipo: 'detran', detalhes: {} })).toBe(false)
    expect(passagemPrecisaDeFoto({ ...base, fonte: 'detran_mg', fonte_tipo: 'detran' })).toBe(true)
    expect(passagemPrecisaDeFoto({ ...base, situacao: 'notificado' })).toBe(false)
    expect(passagemPrecisaDeFoto({ ...base, lote: '' })).toBe(false)
    expect(passagemPrecisaDeFoto({ ...base, fotos_busca: { status: 'fonte_sem_foto' } })).toBe(false)
    expect(passagemPrecisaDeFoto(base, new Set(['copart']))).toBe(false)
    expect(passagemPrecisaDeFoto({ ...base, fotos: ['https://fotos.placacompleta.com.br/a.jpg'] })).toBe(false)
  })
})
