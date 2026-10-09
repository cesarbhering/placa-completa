import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { vehicleTypes } from '../data/vehicle-types'
import { PLANOS } from '../shared/planos'

// /consultar-placa-de-{tipo}: alinhado ao produto (decisao do Cesar, 08/out).
// Gratis = marca, modelo, ano e FIPE NA TELA. Relatorio completo = pago, na
// tela e por e-mail. Nada de "gratis" pro completo, nada de fonte oficial
// nomeada, sem travessao, sem afirmar que o problema existe.
const preco = `R$ ${(PLANOS.completa.valorCentavos / 100).toFixed(2).replace('.', ',')}`

describe('copy das paginas de tipo de veiculo', () => {
  for (const [slug, v] of Object.entries(vehicleTypes)) {
    const textos = [v.title, v.metaTitle, v.metaDescription, v.intro, v.audience, ...v.dataFields, ...v.faqs.flatMap((f) => [f.question, f.answer])]
    const tudo = textos.join(' \n ')
    it(`${slug}: sem promessa antiga (gratis por e-mail, 100% gratis)`, () => {
      expect(tudo).not.toMatch(/100% gr[aá]tis|gr[aá]tis para|receba .{0,60}e-mail|Receber Dados|sem limites/i)
      expect(tudo).not.toMatch(/senatran/i)
      expect(tudo).not.toContain('—')
    })
    it(`${slug}: relatorio completo com o preco de planos.ts, na tela e no e-mail`, () => {
      expect(v.intro).toContain(preco)
      expect(v.faqs.some((f) => f.answer.includes(preco))).toBe(true)
      expect(v.faqs.some((f) => /tela/.test(f.answer) && /e-mail/.test(f.answer))).toBe(true)
    })
    it(`${slug}: checagens como pergunta, nunca afirmando o problema`, () => {
      for (const c of v.dataFields.slice(1, 7)) expect(c).toMatch(/^Se há /)
    })
  }
  it('o template nao promete mais e-mail na consulta gratis', () => {
    const src = readFileSync('pages/consultar-placa-de-[tipo].vue', 'utf8')
    expect(src).not.toMatch(/Receber Dados no E-mail|Informe seu e-mail|Consultar Placa Grátis/)
  })
})
