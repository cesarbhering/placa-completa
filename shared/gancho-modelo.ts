// Gancho por modelo na consulta gratis (Cesar, 04/nov/2026): quando a PLACA
// nao tem sinal de leilao (a maioria), uma linha neutra sobre o MODELO:
// "Veiculos VW Gol aparecem em leiloes na nossa base". Nunca numero, nunca
// placa, nunca afirma nada sobre ESTE carro. A fonte e a tabela leilao_modelos
// (marca, modelo, qtd), populada de madrugada pela equipe de leiloes.
//
// Os dois lados (tabela e consulta) passam pela MESMA normalizacao: sem
// acento, maiusculo, so letras e numeros, e a marca por apelido (a fonte da
// consulta escreve "VW" e "GM"; a tabela pode vir com o nome por extenso).

export interface LinhaLeilaoModelo { marca: string; modelo: string; qtd: number }

const APELIDOS_MARCA: Record<string, string> = {
  VW: 'VOLKSWAGEN', VOLKS: 'VOLKSWAGEN', 'VW VOLKSWAGEN': 'VOLKSWAGEN',
  GM: 'CHEVROLET', CHEV: 'CHEVROLET', 'GM CHEVROLET': 'CHEVROLET',
  MB: 'MERCEDES BENZ', 'M BENZ': 'MERCEDES BENZ', MERCEDES: 'MERCEDES BENZ', MERCEDESBENZ: 'MERCEDES BENZ',
  'LAND ROVER': 'LAND ROVER', LR: 'LAND ROVER',
  CITROEN: 'CITROEN', 'CAOA CHERY': 'CHERY',
}

/** Sem acento, maiusculo, pontuacao vira espaco, espacos colapsados. */
export function normalizarNome(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}

export function normalizarMarca(v: unknown): string {
  const n = normalizarNome(v)
  return APELIDOS_MARCA[n] ?? n
}

const PREFIXOS_DESCARTAVEIS = new Set(['NOVO', 'NOVA', 'NEW'])

/** Tokens do modelo, sem a marca repetida no inicio (importado: "HYUNDAI AZERA 3.0"). */
function tokensModelo(modelo: unknown, marcaNorm: string): string[] {
  let t = normalizarNome(modelo).split(' ').filter(Boolean)
  // "VW/GOL" chega como "VW GOL": tira o primeiro token se ele for a propria marca.
  if (t.length > 1 && normalizarMarca(t[0]) === marcaNorm) t = t.slice(1)
  return t
}

function comecaCom(maior: string[], menor: string[]): boolean {
  return menor.length > 0 && menor.length <= maior.length && menor.every((x, i) => maior[i] === x)
}

/**
 * Linha da tabela que casa com o veiculo da consulta: mesma marca e o modelo
 * da tabela e o COMECO do modelo da consulta, por palavra inteira ("GOL"
 * casa "GOL 1.0", nunca "GOLF"). Mais de uma? Vale a mais especifica. So
 * linhas com qtd > 0.
 */
export function acharModelo(lista: LinhaLeilaoModelo[], marca: unknown, modelo: unknown): LinhaLeilaoModelo | null {
  const m = normalizarMarca(marca)
  if (!m) return null
  const alvo = tokensModelo(modelo, m)
  if (!alvo.length) return null
  const alvoSemNovo = PREFIXOS_DESCARTAVEIS.has(alvo[0]) ? alvo.slice(1) : alvo
  let melhor: { linha: LinhaLeilaoModelo; tam: number } | null = null
  for (const l of lista) {
    if (!(Number(l.qtd) > 0) || normalizarMarca(l.marca) !== m) continue
    const t = tokensModelo(l.modelo, m)
    if (!(comecaCom(alvo, t) || comecaCom(alvoSemNovo, t))) continue
    if (!melhor || t.length > melhor.tam) melhor = { linha: l, tam: t.length }
  }
  return melhor?.linha ?? null
}

/** Siglas de marca que ficam em caixa alta mesmo com 3 letras. */
const SIGLAS = new Set(['BMW', 'BYD', 'GWM', 'JAC', 'KIA', 'RAM', 'JMC', 'MG', 'VW', 'GM'])

/** "GOL" -> "Gol", "T-CROSS" -> "T-Cross"; "HB20", "VW" e "BMW" ficam em caixa alta. */
export function nomeParaFrase(v: unknown): string {
  return String(v ?? '').trim().split(/\s+/).filter(Boolean).map((w) => {
    if (/\d/.test(w) || SIGLAS.has(w.toUpperCase()) || w.replace(/[^A-Za-z]/g, '').length <= 2) return w.toUpperCase()
    return w.toLowerCase().replace(/(^|[-/])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase())
  }).join(' ')
}

/** A frase da tela. Sem numero e sem placa, de proposito. */
export function fraseGanchoModelo(marcaExibida: unknown, modeloDaTabela: unknown): string | null {
  const marca = nomeParaFrase(marcaExibida)
  const modelo = nomeParaFrase(modeloDaTabela)
  if (!marca || !modelo) return null
  return `Veículos ${marca} ${modelo} aparecem em leilões na nossa base`
}
