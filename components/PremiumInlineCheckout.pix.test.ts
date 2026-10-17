import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Clique no Pix vai direto pro QR (Cesar, 16/out/2026). O teste ponta a ponta
// (Playwright com rotas simuladas) esta no PR; aqui fica o contrato do codigo.
const src = readFileSync(join(process.cwd(), 'components/PremiumInlineCheckout.vue'), 'utf8')

describe('checkout: Pix em um clique', () => {
  it('aba Pix chama escolherPix, que segue o MESMO caminho do botao', () => {
    expect(src).toMatch(/class="pic-tab"[^>]*@click="escolherPix"/)
    const fn = src.slice(src.indexOf('function escolherPix()'), src.indexOf('}', src.indexOf('function escolherPix()')) + 1)
    expect(fn).toContain("metodo.value = 'pix'")
    expect(fn).toContain('confirmarEPagar()')
    expect(fn).toContain('editandoPlaca.value')
  })
  it('trava de clique: confirmarEPagar ignora chamada enquanto outra roda', () => {
    const fn = src.slice(src.indexOf('async function confirmarEPagar()'), src.indexOf('function escolherPix()'))
    expect(fn).toContain('if (pagando || loading.value) return')
    expect(fn).toContain('pagando = true')
    expect(fn).toContain('pagando = false')
    expect(fn).toContain('await validarCheckout()')
    expect(fn).toContain('trackAddPaymentInfo(')
  })
  it('cartao continua so selecionando', () => {
    expect(src).toMatch(/class="pic-tab"[^>]*@click="selecionarCartao"/)
    const fn = src.slice(src.indexOf('async function selecionarCartao()'), src.indexOf('async function selecionarCartao()') + 400)
    expect(fn).not.toContain('confirmarEPagar')
  })
  it('respiro de 14px entre o card de garantias e o botao', () => {
    expect(src).toMatch(/\.pic-conf \{[^}]*margin: 0 0 14px;/)
  })
})
