// Title e description de /consultar-placa/[estado] (plano SEO 02/out, item #3).
// RJ, AL, SC e BA tinham CTR de 0,76% a 1,96% contra 2,7% das capitais. A busca
// por UF e "consulta placa detran <uf>": o title passa a falar DETRAN e FIPE e
// trazer o nome do estado (o que as capitais fazem com a cidade). As paginas de
// capital nao mudam. Nada de parecer orgao publico: o texto diz "dados do
// DETRAN", nunca que somos o DETRAN.

export function tituloEstado(uf: string, nome: string): string {
  return `Consulta Placa ${uf} pelo DETRAN e FIPE: ${nome}`
}

export function descricaoEstado(uf: string, nome: string): string {
  return `Consulta de placa de veículo ${deEstado(uf, nome)} (${uf}): marca, modelo, ano e FIPE na hora, e relatório completo com dados do DETRAN, leilão, gravame e roubo.`
}

// "do Rio de Janeiro", "da Bahia", "de Alagoas": artigo de cada UF.
const DA = new Set(['BA', 'PB'])
const DO = new Set(['AC', 'AP', 'AM', 'CE', 'DF', 'ES', 'MA', 'MT', 'MS', 'PA', 'PI', 'PR', 'RJ', 'RN', 'RS', 'TO'])
export function deEstado(uf: string, nome: string): string {
  if (DA.has(uf)) return `da ${nome}`
  if (DO.has(uf)) return `do ${nome}`
  return `de ${nome}`
}
