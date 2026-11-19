import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Cesar, 19/11/2026: while the second-plate offer (R$ 29,90, 24 h) is on the
// report, the repurchase card (10% coupon) and its plain fallback card are hidden.
const fonte = readFileSync(resolve(__dirname, '../pages/premium/[token].vue'), 'utf8')

describe('report end: repurchase cards hidden while the second-plate offer is shown', () => {
  it('the offer reports itself to the page', () => {
    expect(fonte).toContain('onde="relatorio" @oferta="bumpAtivo = $event"')
    expect(fonte).toContain('const bumpAtivo = ref(false)')
  })

  it('both repurchase cards sit inside the !bumpAtivo block, after the offer', () => {
    const oferta = fonte.indexOf('<OfertaSegundaPlaca v-if="token && !isCapacitor"')
    const bloco = fonte.indexOf('<template v-if="!bumpAtivo">')
    const comCupom = fonte.indexOf('<section v-if="cupomCard" class="rel__card rel__card--up rel__recompra">')
    const semCupom = fonte.indexOf('<section v-else class="rel__card rel__card--up rel__recompra">')
    const fim = fonte.indexOf('</template>', semCupom)
    expect(oferta).toBeGreaterThan(-1)
    expect(oferta).toBeLessThan(bloco)
    expect(bloco).toBeLessThan(comCupom)
    expect(comCupom).toBeLessThan(semCupom)
    expect(semCupom).toBeLessThan(fim)
    // Nothing else between the end of the fallback card and the block end.
    expect(fonte.slice(fonte.indexOf('</section>', semCupom) + '</section>'.length, fim).trim()).toBe('')
  })
})
