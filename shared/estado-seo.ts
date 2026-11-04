import { escolherTitulo, emEstado } from './seo-titulo'
import { GANCHO_CONSULTA } from './seo-meta'
// Title e description de /consultar-placa/[estado] (plano SEO 02/out, item #3).
// RJ, AL, SC e BA tinham CTR de 0,76% a 1,96% contra 2,7% das capitais. A busca
// por UF e "consulta placa detran <uf>": o title passa a falar DETRAN e FIPE e
// trazer o nome do estado (o que as capitais fazem com a cidade). As paginas de
// capital nao mudam. Nada de parecer orgao publico: o texto diz "dados do
// DETRAN", nunca que somos o DETRAN.

/** Title FINAL (50 a 60 caracteres, ver shared/seo-titulo.ts); a pagina usa titleTemplate '%s'. */
export function tituloEstado(uf: string, nome: string): string {
  // Plano de growth nov/2026: "buscar placa" no title do DF (sem DETRAN em texto novo).
  if (uf === 'DF') {
    return escolherTitulo([
      `Buscar Placa ${emEstado(uf, nome)}: Consulta e Leilão`,
      `Buscar Placa no DF: Consulta, Leilão e FIPE`,
    ])
  }
  return escolherTitulo([
    `Consulta Placa ${uf} pelo DETRAN e FIPE: ${nome}`,
    `Consulta de Placa ${deEstado(uf, nome)}: DETRAN, FIPE e Leilão`,
    `Consulta de Placa ${deEstado(uf, nome)}: DETRAN e FIPE`,
    `Consulta Placa ${uf}: DETRAN, FIPE e Leilão`,
  ])
}

export function descricaoEstado(uf: string, nome: string): string {
  // Plano de growth nov/2026: gancho de leilao no snippet, sem DETRAN e sem "grátis".
  return `Consulta de placa ${deEstado(uf, nome)} (${uf}) online. ${GANCHO_CONSULTA}`
}

// "do Rio de Janeiro", "da Bahia", "de Alagoas": artigo de cada UF.
const DA = new Set(['BA', 'PB'])
const DO = new Set(['AC', 'AP', 'AM', 'CE', 'DF', 'ES', 'MA', 'MT', 'MS', 'PA', 'PI', 'PR', 'RJ', 'RN', 'RS', 'TO'])
export function deEstado(uf: string, nome: string): string {
  if (DA.has(uf)) return `da ${nome}`
  if (DO.has(uf)) return `do ${nome}`
  return `de ${nome}`
}
