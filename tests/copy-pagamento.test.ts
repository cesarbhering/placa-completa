import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homepageFaqs } from '../data/homepage-faqs'

// Cartao (Stripe) no ar: a copy do site nao pode voltar a dizer que o
// pagamento e so Pix. Telas do PROPRIO fluxo Pix (QR, copia e cola, Pix
// expirado, aba Pix do checkout) podem falar de Pix: e o que a pessoa esta
// usando ali.
const PROIBIDAS = [
  /S[oó] Pix/,
  /Pagamento por Pix(?! ·)/,      // a dica da aba Pix do checkout ("Pagamento por Pix · estorno...") e da propria aba
  /Pague no Pix<\/h3>/,
  /Pix, uma vez/,
  /Pix, na hora, sem assinatura/,
  /Pix · na hora/,
  /Pagamento único no Pix/,
  /sem guardar dados de cartão/,
  /o Pix volta sozinho/i,
  /volta automático no Pix/,
  /Na hora, no Pix\./,
  /depois do Pix/,
]

function arquivos(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) arquivos(p, out)
    else if (/\.(vue|ts)$/.test(p) && !/\.test\.ts$/.test(p)) out.push(p)
  }
  return out
}

describe('copy de forma de pagamento', () => {
  it('nenhuma frase de "so Pix" no site', () => {
    const ruins: string[] = []
    for (const dir of ['pages', 'components', 'data', 'shared', 'composables']) {
      for (const f of arquivos(dir)) {
        if (/woovi-teste|premium\/index\.vue/.test(f)) continue // telas de teste do Pix
        const src = readFileSync(f, 'utf8')
        for (const re of PROIBIDAS) if (re.test(src)) ruins.push(`${f}: ${re}`)
      }
    }
    expect(ruins).toEqual([])
  })
  it('FAQ: formas de pagamento = Pix ou cartao, sem guardar cartao, estorno nos dois', () => {
    const forma = homepageFaqs.find((f) => /formas de pagamento/i.test(f.question))!
    expect(forma.answer).toMatch(/Pix ou cartão de crédito/)
    expect(forma.answer).toMatch(/não guarda os dados do cartão/)
    const estorno = homepageFaqs.find((f) => /não acharem o veículo/i.test(f.question))!
    expect(estorno.answer).toMatch(/no cartão/)
    for (const f of homepageFaqs) expect(`${f.question} ${f.answer}`).not.toContain('—')
  })
})
