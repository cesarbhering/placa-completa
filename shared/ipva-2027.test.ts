import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CALENDARIO_IPVA_2027, FAQ_IPVA_2027, CONFERIDO_EM, TEXTO_NAO_PUBLICADO,
  estimarIpva2027, valorFipeDoTexto, aliquotaEmTexto, reais, ancoraCalendario, UFS_COM_LINK_IPVA_2027,
  tabelaAliquotas,
} from './ipva-2027'

const arq = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')
// toLocaleString puts a no-break space after "R$".
const plano = (s: string) => s.replace(/\s/g, ' ')
const carro = (valorFipe: unknown, uf: string, extra: Record<string, unknown> = {}) =>
  estimarIpva2027({ valorFipe: valorFipe as any, uf, segmento: 'carro', combustivel: 'comum', ...extra })

describe('valorFipeDoTexto', () => {
  it('reads the FIPE text of the free lookup', () => {
    expect(valorFipeDoTexto('R$ 45.678,00')).toBe(45678)
    expect(valorFipeDoTexto('R$ 1.234.567,89')).toBe(1234567.89)
    expect(valorFipeDoTexto('50.000')).toBe(50000)
    expect(valorFipeDoTexto(32000)).toBe(32000)
  })
  it('returns null without a positive amount', () => {
    for (const v of [null, undefined, '', 'Não disponível', 'R$ 0,00', 0, -5, Number.NaN]) {
      expect(valorFipeDoTexto(v)).toBeNull()
    }
  })
})

describe('estimarIpva2027', () => {
  it('multiplies the FIPE value by the checked passenger-car rate of the state', () => {
    const esperado: Record<string, number> = { SP: 2000, MG: 2000, RS: 1500, MS: 1500, PR: 950, PE: 1200, DF: 1500, SC: 1000 }
    for (const [uf, ipva] of Object.entries(esperado)) {
      expect(carro(50000, uf)).toMatchObject({ tipo: 'valor', uf, ipva, valorFipe: 50000 })
    }
  })
  it('accepts the FIPE text, a lowercase state and rounds to whole reais', () => {
    expect(carro('R$ 87.654,00', ' sp ')).toMatchObject({ tipo: 'valor', uf: 'SP', ipva: 3506 })
  })
  it('picks a value tier from the FIPE value (PI, SE)', () => {
    expect(carro(50000, 'PI')).toMatchObject({ tipo: 'valor', aliquota: 0.025, ipva: 1250 })
    expect(carro(200000, 'PI')).toMatchObject({ tipo: 'valor', aliquota: 0.03, ipva: 6000 })
    expect(carro(130000, 'SE')).toMatchObject({ tipo: 'valor', aliquota: 0.03 })
  })
  it('shows the range where the rate depends on power or engine size (no guess)', () => {
    expect(carro(50000, 'CE')).toMatchObject({ tipo: 'faixa', ipvaMin: 1250, ipvaMax: 1750, depende: 'potencia' })
    expect(carro(50000, 'GO')).toMatchObject({ tipo: 'faixa', ipvaMin: 1500, ipvaMax: 1875, depende: 'potencia' })
    expect(carro(50000, 'AL')).toMatchObject({ tipo: 'faixa', ipvaMin: 1375, ipvaMax: 1625, depende: 'potencia' })
    expect(carro(50000, 'MT')).toMatchObject({ tipo: 'faixa', ipvaMin: 1000, ipvaMax: 1500, depende: 'cilindrada' })
  })
  it('other fuels: the stated rate or no number', () => {
    expect(carro(50000, 'RJ', { combustivel: 'hibrido' })).toMatchObject({ tipo: 'valor', aliquota: 0.015, ipva: 750 })
    expect(carro(50000, 'SP', { combustivel: 'eletrico' })).toMatchObject({ tipo: 'combustivel_especial', combustivel: 'eletrico' })
    expect(carro(50000, 'SP', { combustivel: null })).toMatchObject({ tipo: 'combustivel_especial', combustivel: null })
  })
  it('gives no number for motorcycles and trucks, even with a FIPE value', () => {
    expect(carro(18000, 'SP', { segmento: 'moto' })).toEqual({ tipo: 'nao_automovel', segmento: 'moto' })
    expect(carro(300000, 'MG', { segmento: 'caminhao' })).toEqual({ tipo: 'nao_automovel', segmento: 'caminhao' })
  })
  it('gives no number for a state whose rate was not checked', () => {
    expect(carro(50000, 'MA')).toEqual({ tipo: 'aliquota_nao_conferida', uf: 'MA' })
  })
  it('asks for the FIPE value and the state when they are missing', () => {
    expect(carro(null, 'SP')).toEqual({ tipo: 'sem_fipe' })
    expect(carro(50000, '')).toEqual({ tipo: 'sem_uf' })
    expect(carro(50000, 'São Paulo')).toEqual({ tipo: 'sem_uf' })
  })
  it('formats the rate and the amount in pt-BR', () => {
    expect(aliquotaEmTexto(0.019)).toBe('1,9%')
    expect(aliquotaEmTexto(0.04)).toBe('4%')
    expect(plano(reais(2000))).toBe('R$ 2.000')
  })
  it('the table of the page has one row per state', () => {
    const t = tabelaAliquotas(50000)
    expect(t).toHaveLength(27)
    expect(t.find((l) => l.uf === 'MA')!.estimativa.tipo).toBe('aliquota_nao_conferida')
  })
})

describe('calendar 2027', () => {
  it('covers SP, MG, RS and MS, the states rising in search', () => {
    expect(CALENDARIO_IPVA_2027.map((c) => c.uf).sort()).toEqual(['MG', 'MS', 'RS', 'SP'])
    expect([...UFS_COM_LINK_IPVA_2027].sort()).toEqual(['MG', 'MS', 'RS', 'SP'])
  })
  it('a state that did not publish shows no date at all', () => {
    for (const c of CALENDARIO_IPVA_2027.filter((x) => x.status === 'nao_publicado')) {
      expect(c.resumo).toBe(TEXTO_NAO_PUBLICADO)
      expect(c.vencimentos).toBeUndefined()
      expect([c.resumo, ...c.regras].join(' ')).not.toMatch(/\b\d{1,2}\/\d{1,2}\/2027\b|janeiro de 2027|fevereiro de 2027/)
    }
    expect(CALENDARIO_IPVA_2027.find((c) => c.uf === 'MG')!.status).toBe('nao_publicado')
    expect(CALENDARIO_IPVA_2027.find((c) => c.uf === 'RS')!.status).toBe('nao_publicado')
  })
  it('SP: due days 11 to 22 by plate final, as in Decreto 70.960/2026', () => {
    const sp = CALENDARIO_IPVA_2027.find((c) => c.uf === 'SP')!
    expect(sp.status).toBe('publicado')
    expect(sp.vencimentos!.map((v) => `${v.final}:${v.dia}`)).toEqual(['1:11', '2:12', '3:13', '4:14', '5:15', '6:18', '7:19', '8:20', '9:21', '0:22'])
    expect(sp.fonte.nome).toContain('70.960')
  })
  it('MS: only the single-payment deadline, no installment dates', () => {
    const ms = CALENDARIO_IPVA_2027.find((c) => c.uf === 'MS')!
    expect(ms.status).toBe('parcial')
    expect(ms.vencimentos).toBeUndefined()
    expect(ms.resumo).toContain('28 de dezembro de 2026')
    expect(ms.regras.join(' ')).toContain('6.654')
  })
  it('every state names an official source and the check date', () => {
    for (const c of CALENDARIO_IPVA_2027) {
      expect(c.fonte.url).toMatch(/^https:\/\/[^/]+\.gov\.br\//)
      expect(c.conferidoEm).toBe(CONFERIDO_EM)
    }
  })
  it('builds the anchor that the state pages link to', () => {
    expect(ancoraCalendario('SP')).toBe('calendario-sp')
  })
})

describe('public copy rules', () => {
  const textos = [
    ...FAQ_IPVA_2027.flatMap((f) => [f.q, f.a]),
    ...CALENDARIO_IPVA_2027.flatMap((c) => [c.resumo, ...c.regras, c.fonte.nome]),
  ]
  const template = (p: string) => /<template>([\s\S]*)<\/template>/.exec(arq(p))![1]
  const telas = [template('pages/ipva-2027.vue'), template('components/Ipva2027Estimativa.vue')]

  it('no em dash, no exclamation mark and no SENATRAN', () => {
    for (const t of [...textos, ...telas]) {
      expect(t).not.toContain('—')
      expect(t).not.toMatch(/senatran/i)
    }
    for (const t of textos) expect(t).not.toContain('!')
    // In the templates "!" would only show up as text (no negation is used there).
    for (const t of telas) expect(t.replace(/<!--[\s\S]*?-->/g, '')).not.toContain('!')
  })
  it('no "grátis" in the FAQ, which also feeds the FAQPage JSON-LD', () => {
    for (const f of FAQ_IPVA_2027) expect(`${f.q} ${f.a}`).not.toMatch(/gr[aá]tis|gratuit/i)
  })
  it('says the estimate is neither the official value nor a debt lookup', () => {
    for (const t of telas) expect(t.replace(/\s+/g, ' ')).toMatch(/não o valor oficial nem uma consulta de débitos/)
  })
})
