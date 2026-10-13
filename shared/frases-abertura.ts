// H1 e primeira frase das paginas de marca, modelo, estado e capital (plano GEO
// 13/out, secao 2). A IA cita o nome quando a frase se sustenta sozinha e o
// nome e o sujeito: por isso "a Placa Completa" aparece na primeira frase.
// Regras de copy: sem travessao, sem citar orgao de transito como fonte, sem
// afirmar problema no veiculo ("indicadores", nunca "tem leilao").

import { brl, sujeitoModelo, type ValorAno, faixaGeral, mesReferencia, type Referencia } from './fipe-por-ano'

const marcaCurta = (marca: string) => marca.replace(/\s+Motos$/i, '')

/** "A, B e C" */
export function listaNatural(itens: string[]): string {
  if (itens.length <= 1) return itens[0] || ''
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

// ----- marca (/tabela-fipe/<marca>) -----

export function h1Marca(marca: string): string {
  return `Tabela FIPE ${marca} por modelo e ano`
}

export function aberturaMarca(marca: string, modelos: string[], tipo: 'carros' | 'motos'): string {
  const destaque = modelos.slice(0, 3)
  const resto = modelos.length - destaque.length
  // Com "outros N modelos" a lista vai so com virgulas: "C3, C4 Cactus, Aircross e outros 2 modelos".
  const lista = resto > 0
    ? `${destaque.join(', ')} e outros ${resto} ${resto === 1 ? 'modelo' : 'modelos'}`
    : listaNatural(destaque)
  const seu = tipo === 'motos' ? 'da sua moto' : 'do seu veículo'
  return `Consulte a tabela FIPE da ${marca} por modelo e ano na Placa Completa: veja o valor médio de ${lista}, atualizado todo mês. Para saber o valor ${seu}, informe a placa.`
}

// ----- modelo (/tabela-fipe/<marca>-<modelo>) -----

export function h1Modelo(marca: string, modelo: string): string {
  return `${marcaCurta(marca)} ${modelo}: valor na Tabela FIPE por ano`
}

export interface FaixaAbertura { min: number; max: number }

/**
 * Com preco: "O Toyota Corolla vale de R$ X a R$ Y na Tabela FIPE de
 * outubro/2026, conforme o ano de fabricação. A Placa Completa mostra ..."
 * Sem preco: variante sem numero.
 */
export function aberturaModelo(opts: {
  marca: string
  modelo: string
  tipo: 'carros' | 'motos'
  genero?: 'm' | 'f'
  faixa: FaixaAbertura | null
  referencia: Referencia | null
}): string {
  const sujeito = sujeitoModelo(opts.marca, opts.modelo, opts.tipo, opts.genero)
  const seu = opts.tipo === 'motos' ? 'da sua moto' : 'do seu veículo'
  if (!opts.faixa) {
    const artigo = sujeito.startsWith('A ') ? 'a' : 'o'
    return `Veja quanto vale ${artigo} ${sujeito.slice(2)} na Tabela FIPE por ano. A Placa Completa mostra o valor atualizado ${seu} pela placa, com os dados do cadastro e indicadores de leilão.`
  }
  const mes = mesReferencia(opts.referencia)
  const quando = mes ? ` na Tabela FIPE de ${mes}` : ' na Tabela FIPE'
  const valor = opts.faixa.min === opts.faixa.max
    ? `vale ${brl(opts.faixa.max)}`
    : `vale de ${brl(opts.faixa.min)} a ${brl(opts.faixa.max)}`
  return `${sujeito} ${valor}${quando}, conforme o ano de fabricação. A Placa Completa mostra o valor por ano e o valor exato ${seu} pela placa.`
}

/** Faixa da abertura: todas as versoes por ano; sem isso, a tabela da versao. */
export function faixaDoModelo(porAno: ValorAno[], tabela: { price: number }[]): FaixaAbertura | null {
  const g = faixaGeral(porAno)
  if (g) return { min: g.min, max: g.max }
  const precos = tabela.map((r) => Number(r.price)).filter((p) => p > 0)
  return precos.length ? { min: Math.min(...precos), max: Math.max(...precos) } : null
}

// ----- estado (/consultar-placa/<estado>) -----

/** `emUf` ja vem com a preposicao certa ("em São Paulo", "na Bahia", "no Rio de Janeiro"). */
export function h1Estado(emUf: string, uf: string): string {
  return `Consultar placa ${emUf} (${uf}): marca, modelo, ano e FIPE`
}

export function aberturaEstado(emUf: string): string {
  return `Consulte na Placa Completa a placa de qualquer veículo emplacado ${emUf} e veja marca, modelo, ano, cor e valor na Tabela FIPE. A consulta básica é grátis e o resultado sai em segundos.`
}

// ----- capital (/consultar-placa/capital/<cidade>) -----

// Cidade com artigo: "no Rio de Janeiro", "do Rio de Janeiro".
const CIDADE_MASCULINA = new Set(['Rio de Janeiro'])

export const emCidade = (cidade: string) => `${CIDADE_MASCULINA.has(cidade) ? 'no' : 'em'} ${cidade}`
export const deCidade = (cidade: string) => `${CIDADE_MASCULINA.has(cidade) ? 'do' : 'de'} ${cidade}`

export function h1Capital(cidade: string, uf: string): string {
  return `Consultar placa ${emCidade(cidade)} (${uf}): dados do veículo e FIPE`
}

export function aberturaCapital(cidade: string): string {
  return `Consulte na Placa Completa a placa de um veículo ${deCidade(cidade)} e veja marca, modelo, ano, situação e valor na Tabela FIPE antes de comprar. Informe a placa e receba o resultado em segundos.`
}

// ----- /consulta-placa (buscas genericas: "consultar placas", "puxar placa") -----

export const ABERTURA_CONSULTA = 'Consulte a placa de qualquer carro ou moto na Placa Completa: veja marca, modelo, ano, cor, valor na Tabela FIPE e indicadores de leilão. Grátis e em segundos.'
