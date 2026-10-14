// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSSRApp, h, computed } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { textoHodometro, ALERTA_HODOMETRO } from './hodometro-texto'

const EXTRATO = [{ km: '30.100', data: '10/01/2024' }, { km: '45.210', data: '12/03/2025' }]
const ORIENTACAO = 'Compare a marcação atual do painel com a última leitura registrada: 45.210 km em 12/03/2025. Se o painel mostrar menos que isso, peça explicação ao vendedor antes de fechar.'

// Mesmo <p> do pages/premium/[token].vue (linha da frase do hodometro).
async function render(suspeito: boolean, extrato = EXTRATO) {
  const app = createSSRApp({
    setup() {
      const fraseHodometro = computed(() => textoHodometro({ suspeito, extrato }))
      return () => fraseHodometro.value
        ? h('p', { class: fraseHodometro.value.tipo === 'alerta' ? 'rel__multas-kmalerta' : 'rel__multas-kmok' }, fraseHodometro.value.texto)
        : null
    },
  })
  return renderToString(app)
}

describe('frase do hodometro', () => {
  it('sem regressao: orientacao com a ultima leitura, sem afirmar nada sobre adulteracao', async () => {
    const html = await render(false)
    expect(html).toContain('class="rel__multas-kmok"')
    expect(html).toContain(ORIENTACAO)
    expect(html).not.toMatch(/adultera|Sem regressão|Sem indício/i)
    expect(html).not.toContain('—')
  })
  it('km caiu: alerta vermelho igual ao de antes', async () => {
    const html = await render(true)
    expect(html).toContain('class="rel__multas-kmalerta"')
    expect(html).toContain(ALERTA_HODOMETRO)
    expect(html).not.toContain('Compare a marcação')
  })
  it('sem extrato: nada; ultima linha sem km: orientacao sem numero', () => {
    expect(textoHodometro({ suspeito: false, extrato: [] })).toBeNull()
    expect(textoHodometro({ suspeito: false, extrato: [{ km: '-', data: '' }] })!.texto)
      .toBe('Compare a marcação atual do painel com a última leitura registrada acima. Se o painel mostrar menos que isso, peça explicação ao vendedor antes de fechar.')
  })
  it('a pagina usa a funcao e nao tem mais a frase antiga', () => {
    const vue = readFileSync(join(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    expect(vue).not.toContain('Sem indício de hodômetro adulterado')
    expect(vue).toContain('{{ fraseHodometro.texto }}')
  })
})
