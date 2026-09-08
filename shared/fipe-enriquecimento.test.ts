import { describe, it, expect } from 'vitest'
import { ENRIQUECIMENTO_FIPE } from './fipe-enriquecimento'
import { REGIONAL, GENERICAS } from './enriquecimento-regional'

// Estas 27 paginas estavam "rastreada, nao indexada" porque eram quase iguais
// entre si. O teste existe pra impedir que o remedio vire a doenca: texto
// repetido entre paginas nao pode voltar sem alguem perceber.
const todosOsTextos = [
  ...Object.entries(ENRIQUECIMENTO_FIPE).flatMap(([slug, e]) => [
    ...(e.paragrafoUnico ? [[slug, e.paragrafoUnico] as const] : []),
    ...(e.leilao ? [[slug, e.leilao.dado] as const] : []),
  ]),
  ...Object.entries(REGIONAL).map(([uf, b]) => [uf, b.texto] as const),
  ...Object.entries(GENERICAS).map(([rota, b]) => [rota, b.texto] as const),
]

describe('enriquecimento das paginas nao indexadas', () => {
  it('nenhum paragrafo se repete entre paginas', () => {
    const vistos = new Map<string, string>()
    for (const [chave, texto] of todosOsTextos) {
      const anterior = vistos.get(texto)
      expect(anterior, `${chave} repete o texto de ${anterior}`).toBeUndefined()
      vistos.set(texto, chave)
    }
  })

  it('cada paragrafo tem tamanho de paragrafo de verdade', () => {
    for (const [chave, texto] of todosOsTextos) {
      expect(texto.length, `${chave}: curto demais pra valer como conteudo`).toBeGreaterThan(200)
    }
  })

  it('os quatro modelos de amostra pequena ficam sem bloco de leilao', () => {
    for (const slug of ['ford-territory', 'audi-q7', 'chevrolet-equinox', 'byd-song-plus']) {
      expect(ENRIQUECIMENTO_FIPE[slug]?.leilao, `${slug} nao deveria ter bloco`).toBeUndefined()
    }
  })

  it('todo bloco de leilao cita a base e o periodo', () => {
    for (const [slug, e] of Object.entries(ENRIQUECIMENTO_FIPE)) {
      if (!e.leilao) continue
      expect(e.leilao.dado, `${slug}`).toMatch(/base/i)
      expect(e.leilao.dado, `${slug}`).toMatch(/\d{4}/)
    }
  })

  it('copy sem travessao, sem promessa de certeza e sem citar a fonte', () => {
    for (const [chave, texto] of todosOsTextos) {
      expect(texto, `${chave}`).not.toContain('—')
      const baixo = texto.toLowerCase()
      expect(baixo, `${chave}`).not.toContain('senatran')
      expect(baixo, `${chave}`).not.toContain('garantimos')
    }
  })

  it('toda FAQ tem pergunta terminando em interrogacao e resposta util', () => {
    const faqs = [
      ...Object.values(ENRIQUECIMENTO_FIPE).flatMap((e) => e.faq || []),
      ...Object.values(REGIONAL).flatMap((b) => b.faq),
      ...Object.values(GENERICAS).flatMap((b) => b.faq),
    ]
    expect(faqs.length).toBeGreaterThan(60)
    for (const q of faqs) {
      expect(q.pergunta.endsWith('?')).toBe(true)
      expect(q.resposta.length).toBeGreaterThan(40)
    }
  })
})
