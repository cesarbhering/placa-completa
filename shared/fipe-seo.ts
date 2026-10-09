// Title e description das paginas /tabela-fipe/* (plano SEO 02/out, item #2).
// MT-03 e Lander tinham 7 mil e 5 mil impressoes com CTR de 0,04%: a busca e
// "tabela fipe <modelo> <ano>", e o title falava do mes, nao do ano-modelo.
// Agora o title traz o ANO-MODELO mais recente e "Valor Atualizado", e a
// description traz a faixa de preco por ano. Sem "gratis".

export interface LinhaFipe { year: number; price: number; priceFormatted?: string }

const ZERO_KM = 32000 // codigo FIPE de veiculo 0 km

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`

/** Ano-modelo mais recente da tabela (0 km vira o ano corrente). */
export function anoMaisRecente(tabela: LinhaFipe[], anoAtual: number): number | null {
  const anos = tabela.map((r) => Number(r.year)).filter((y) => y > 1900 && y < 3000)
  const temZeroKm = tabela.some((r) => Number(r.year) === ZERO_KM)
  const max = anos.length ? Math.max(...anos) : null
  if (temZeroKm) return Math.max(max ?? anoAtual, anoAtual)
  return max
}

export function faixaFipe(tabela: LinhaFipe[]) {
  const validas = tabela.filter((r) => Number(r.price) > 0)
  if (!validas.length) return null
  const min = validas.reduce((a, b) => (b.price < a.price ? b : a))
  const max = validas.reduce((a, b) => (b.price > a.price ? b : a))
  const rotulo = (r: LinhaFipe) => (Number(r.year) === ZERO_KM ? '0 km' : String(r.year))
  return { min: brl(min.price), minAno: rotulo(min), max: brl(max.price), maxAno: rotulo(max) }
}

/** "Honda Motos" vira "Honda" no title/description do MODELO (a busca e "fipe bros 160"). */
export const marcaCurta = (marca: string) => marca.replace(/\s+Motos$/i, '')

export function tituloModelo(marcaBruta: string, modelo: string, tabela: LinhaFipe[], anoAtual: number): string {
  const marca = marcaCurta(marcaBruta)
  const ano = anoMaisRecente(tabela, anoAtual)
  return ano
    ? `Tabela FIPE ${marca} ${modelo} ${ano}: Valor Atualizado`
    : `Tabela FIPE ${marca} ${modelo}: Valor Atualizado por Ano`
}

export function descricaoModelo(marcaBruta: string, modelo: string, tabela: LinhaFipe[]): string {
  const marca = marcaCurta(marcaBruta)
  const f = faixaFipe(tabela)
  if (!f) return `${marca} ${modelo} na Tabela FIPE com valor atualizado por ano-modelo e versão. Veja o histórico de preços e consulte o valor exato pela placa.`
  const faixa = f.min === f.max ? `${f.max} (${f.maxAno})` : `de ${f.min} (${f.minAno}) a ${f.max} (${f.maxAno})`
  return `${marca} ${modelo} na Tabela FIPE com valor atualizado: ${faixa}. Preço por ano-modelo e consulta do valor exato pela placa.`
}

export function tituloMarca(marca: string, anoAtual: number): string {
  return `Tabela FIPE ${marca} ${anoAtual}: Valor Atualizado dos Modelos`
}

/**
 * Ate 3 modelos, e so os que couberem: a description fica em no maximo 160
 * caracteres (shared/seo-meta.ts). Nome de marca/modelo longo derruba modelo
 * da lista em vez de estourar o limite.
 */
export function descricaoMarca(marca: string, modelos: string[], anoAtual: number): string {
  const montar = (lista: string[]) => {
    const nomes = lista.length > 1 ? `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}` : lista[0]
    return lista.length
      ? `Tabela FIPE ${marca} ${anoAtual}: valor atualizado de ${nomes} e outros modelos, com preço por ano-modelo e consulta do valor exato pela placa.`
      : `Tabela FIPE ${marca} ${anoAtual}: valor atualizado de todos os modelos da marca, com preço por ano-modelo e consulta do valor exato pela placa.`
  }
  for (let n = Math.min(3, modelos.length); n > 0; n--) {
    const texto = montar(modelos.slice(0, n))
    if (texto.length <= 160) return texto
  }
  return montar([])
}
