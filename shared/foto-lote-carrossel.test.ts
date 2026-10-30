import { describe, it, expect } from 'vitest'
import { fotoRefsDaPassagem, videosDaPassagem, embedDeVideo, midiasDaPassagem, fotoRefDoRelatorio, MAX_MIDIAS_LOTE } from './foto-lote'

const REF = (n: number) => `ref${n}.abcdefABCDEF0123456789`
const fotos = (n: number) => Array.from({ length: n }, (_, i) => ({ ordem: n - i, vista: i === 0 ? 'frente' : null, url_origem: `https://x/${i}.jpg`, foto_ref: REF(i) }))

describe('fotos sem limite de 4 (carrossel, 27/out/2026)', () => {
  it('todas as fotos, na ordem de "ordem"', () => {
    const r = fotoRefsDaPassagem({ detalhes: { fotos: fotos(18) } })
    expect(r).toHaveLength(18)
    expect(r.map((f) => f.ordem)).toEqual([...r.map((f) => f.ordem)].sort((a, b) => a - b))
  })
  it('teto de sanidade', () => {
    expect(fotoRefsDaPassagem({ detalhes: { fotos: fotos(MAX_MIDIAS_LOTE + 20) } })).toHaveLength(MAX_MIDIAS_LOTE)
  })
})

describe('videos do lote (detalhes.videos)', () => {
  const det = { videos: [
    { ordem: 2, url_origem: 'https://leiloeira/v.mp4', foto_ref: REF(90) },
    { ordem: 1, url_origem: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', so_link: 'plataforma' },
    { ordem: 3, url_origem: 'https://vimeo.com/123456789', so_link: 'plataforma' },
    { ordem: 4, url_origem: 'https://leiloeira/grande.mp4', so_link: 'grande' },
    { ordem: 5, url_origem: 'https://leiloeira/x.mp4', so_link: 'falhou' },
    { ordem: 6, url_origem: 'https://site-estranho.com/v', so_link: 'plataforma' },
  ] }
  it('R2 por ref, embed YouTube/Vimeo, link grande; falhou e host estranho ficam fora', () => {
    const v = videosDaPassagem({ detalhes: det })
    expect(v).toEqual([
      { ref: null, ordem: 1, so_link: 'plataforma', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' },
      { ref: REF(90), ordem: 2, so_link: null, url: null },
      { ref: null, ordem: 3, so_link: 'plataforma', url: 'https://player.vimeo.com/video/123456789' },
      { ref: null, ordem: 4, so_link: 'grande', url: 'https://leiloeira/grande.mp4' },
    ])
  })
  it('embedDeVideo: youtu.be, shorts, nada fora de YouTube/Vimeo', () => {
    expect(embedDeVideo('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(embedDeVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(embedDeVideo('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(embedDeVideo('javascript:alert(1)')).toBeNull()
  })
  it('midiasDaPassagem: fotos primeiro, depois videos; R2 sempre pela nossa rota', () => {
    const m = midiasDaPassagem({ detalhes: { fotos: fotos(3), ...det } }, 'TOKEN12345')
    expect(m.map((x) => x.tipo)).toEqual(['foto', 'foto', 'foto', 'embed', 'video', 'embed', 'link'])
    expect(m[4].src).toBe(`/api/premium/foto?token=TOKEN12345&ref=${encodeURIComponent(REF(90))}`)
    for (const x of m) expect(x.alt).not.toContain('—')
  })
  it('sem video: so fotos', () => {
    expect(midiasDaPassagem({ detalhes: { fotos: fotos(2) } }, 'TOKEN12345').map((x) => x.tipo)).toEqual(['foto', 'foto'])
  })
  it('ref de video tambem pertence ao relatorio (rota /api/premium/foto)', () => {
    const snap = { historicoLeilao: { passagens: [{ detalhes: det, video_refs: videosDaPassagem({ detalhes: det }) }] } }
    expect(fotoRefDoRelatorio(snap, REF(90))).toBe(true)
    expect(fotoRefDoRelatorio(snap, REF(91))).toBe(false)
  })
})
