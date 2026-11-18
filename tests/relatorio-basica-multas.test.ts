import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Basica e o bloco do DETRAN (18/11/2026, pedido de uma Basica da BA): a Basica
// nao consulta o DETRAN na entrega, mas um backfill pode gravar o bloco no
// pedido. Antes desta correcao a tela da Basica (1) esperava "Consultando
// multas no DETRAN-XX" sem consulta nenhuma e (2) nunca mostrava o cartao de
// multas, porque ele vive na secao de Restricoes, que so a Completa tem.
const vue = readFileSync('pages/premium/[token].vue', 'utf8')
const secao = vue.slice(vue.indexOf('<section v-if="numSecao.restr"'), vue.indexOf('</section>', vue.indexOf('<section v-if="numSecao.restr"')))

describe('basic plan and the DETRAN block', () => {
  it('the section exists on the basic plan only when the order has the fines block', () => {
    expect(vue).toContain("if (isBasica.value ? !!multasDetalhe.value : temIndicadores.value) ordem.push('restr')")
    expect(vue).not.toContain("if (!isBasica.value && temIndicadores.value) ordem.push('restr')")
  })
  it('on the basic plan the section is titled for fines and shows only the fines card', () => {
    expect(secao).toContain("{{ isBasica ? 'Multas e débitos' : 'Restrições' }}")
    // Restrictions, notes and recall stay in two blocks closed to the basic plan.
    expect(secao.match(/<template v-if="!isBasica">/g)).toHaveLength(2)
    const i1 = secao.indexOf('<template v-if="!isBasica">')
    const multas = secao.indexOf('class="rel__multas"')
    const i2 = secao.indexOf('<template v-if="!isBasica">', i1 + 1)
    expect(i1).toBeLessThan(secao.indexOf('v-for="(r, idx) in restricoes"'))
    expect(secao.lastIndexOf('</template>', multas)).toBeGreaterThan(secao.indexOf('v-for="(a, ai) in anotacoes"'))
    expect(multas).toBeLessThan(i2)
    expect(i2).toBeLessThan(secao.indexOf('v-if="recallMontadora"'))
  })
  it('the fines card on the basic plan needs the block (never a "consultando" card)', () => {
    expect(secao).toContain('&& (!isBasica || multasDetalhe)" class="rel__multas"')
  })
  it('the old DETRAN wait (no source list from the server) never applies to the basic plan', () => {
    expect(vue).toContain('if (!entregue.value || !ehVeiculoSpTela.value || isBasica.value) return null')
  })
  it('no dash in the new copy', () => {
    expect(secao).not.toMatch(/—/)
  })
})
