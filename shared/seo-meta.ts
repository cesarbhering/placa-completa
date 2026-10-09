import { escolherTitulo, emEstado } from './seo-titulo'

// Meta descriptions do site, num lugar so (auditoria Ahrefs, 08/out: 93
// paginas com description acima de 160 caracteres, que o Google corta).
//
// Regra: entre 110 e 160 caracteres, palavra-chave principal no comeco, sem
// travessao e sem citar a fonte oficial dos dados. As paginas programaticas
// montam a description por funcao daqui, e shared/seo-meta.test.ts varre todas
// as entradas (capitais, estados, modelos, marcas, posts) e falha se alguma
// sair da faixa.

export const DESCRICAO_MIN = 110
export const DESCRICAO_MAX = 160

/** Cabe na faixa do Google sem corte e sem ficar curta demais? */
export function descricaoNaFaixa(texto: string): boolean {
  const n = texto.length
  return n >= DESCRICAO_MIN && n <= DESCRICAO_MAX
}

/** Titulo com problema: marca repetida pelo template ou travessao. */
export function problemaNoTitulo(titulo: string): string | null {
  if (/\|\s*PlacaCompleta\s*\|\s*PlacaCompleta/i.test(titulo)) return 'marca duplicada'
  if (/\|\s*PlacaCompleta\s*$/i.test(titulo)) return 'sufixo de marca no texto (o modulo de SEO ja anexa)'
  if (titulo.includes('—')) return 'travessao'
  return null
}

// --- Paginas fixas ----------------------------------------------------------

export const DESCRICOES = {
  home: 'Consulta de placa com relatório completo: leilão, roubo, gravame, multas e recall pendente. Veja o que o vendedor não conta antes de fechar negócio.',
  sobre: 'Sobre o PlacaCompleta: como funciona a consulta veicular por placa, de onde vêm os dados (bases oficiais, FIPE, banco BV), a metodologia do IBV e a LGPD.',
  comoConsultarPlaca: 'Como consultar placa de veículo: passo a passo para ver marca, modelo, FIPE e situação, e o relatório completo com leilão, gravame, roubo e débitos.',
  estudos: 'Estudos do mercado de veículos no Brasil: seguro por região (dados SUSEP), IBV Auto do Banco BV e preços da Tabela FIPE, com metodologia aberta.',
  consultaPlaca: 'Consulta de placa veicular online: veja marca, modelo, ano, FIPE e situação na hora, e o relatório completo de leilão, gravame, roubo e débitos.',
  carroDeLeilao: 'Carro de leilão nem sempre aparece no documento. Veja o que significa, os tipos de leilão e como descobrir se o carro que você vai comprar já passou por um.',
  contato: 'Contato do PlacaCompleta: e-mail para dúvidas sobre consulta de placa, relatório, correção de dados e imprensa, com resposta em até 2 dias úteis.',
} as const

/** /tabela-fipe-por-placa. Sem "grátis": decisão de 01/out de se distanciar do grátis nas superfícies de busca. */
export function descricaoTabelaFipePorPlaca(mes: string, ano: number): string {
  return `Tabela FIPE pela placa: consulte o valor FIPE de qualquer veículo em ${mes} de ${ano}, com marca, modelo, ano, código FIPE e preço atualizado do mês.`
}

// --- Paginas programaticas --------------------------------------------------

/** /consultar-placa/capital/{slug} */
export function descricaoCapital(cidade: string, uf: string): string {
  return `Consultar placa em ${cidade} (${uf}): veja marca, modelo, ano, situação e valor FIPE, e o relatório completo com leilão, gravame, roubo e débitos.`
}

/** /carro-de-leilao/{modelo} */
export function descricaoLeilaoModelo(nomeCompleto: string, nome: string): string {
  return `${nomeCompleto} de leilão: o que significa, o que a nossa base mostra sobre o modelo e como saber se o ${nome} que você vai comprar já passou por leilão.`
}

function brlInteiro(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

/** /seguro/carro-eletrico */
export function descricaoSeguroEletrico(mediaNacional: number): string {
  return `Seguro de carro elétrico no Brasil: média nacional de ${brlInteiro(mediaNacional)}/ano. Compare o preço em todos os estados, com dados SUSEP corrigidos pelo IPCA.`
}

/** /seguro/carro-eletrico/{estado} */
export function descricaoSeguroEletricoEstado(estado: string, media: number, uf?: string): string {
  const onde = uf ? emEstado(uf, estado) : `em ${estado}`
  return `Seguro de carro elétrico ${onde}: média de ${brlInteiro(media)}/ano, com dados SUSEP corrigidos pelo IPCA. Veja o valor por modelo e peça cotação.`
}

// --- Titles programaticos (title FINAL, 50 a 60; ver shared/seo-titulo.ts) --

/** /consultar-placa/capital/{slug} */
export function tituloCapital(cidade: string, uf: string): string {
  return escolherTitulo([
    `Consultar Placa ${cidade} (${uf}): Leilão, Roubo e FIPE`,
    `Consultar Placa ${cidade} (${uf}): Leilão e FIPE`,
    `Consultar Placa em ${cidade} (${uf}): Leilão, Roubo e FIPE`,
    `Consultar Placa ${cidade} (${uf})`,
  ])
}

/** /seguro/carro-eletrico/{estado} */
export function tituloSeguroEletricoEstado(uf: string, estado: string, ano: number): string {
  const onde = emEstado(uf, estado)
  return escolherTitulo([
    `Seguro de Carro Elétrico ${onde}: Preço Médio ${ano}`,
    `Seguro de Carro Elétrico ${onde}: Preço Médio`,
    `Seguro Carro Elétrico ${uf}: Preço Médio ${ano}`,
    `Seguro de Carro Elétrico ${onde}`,
  ])
}

/** /carro-de-leilao/{modelo}: o title do dado vem com o sufixo antigo. */
export function tituloLeilaoModelo(titleDoDado: string, nome: string): string {
  return escolherTitulo([
    titleDoDado.replace(/\s*\|\s*PlacaCompleta\s*$/, ''),
    `${nome} de Leilão: Como Saber se Já Passou`,
    `${nome} de Leilão: Como Saber`,
  ])
}

/** /consultar-placa-de-{tipo} */
export function tituloTipoVeiculo(metaTitle: string, nome: string): string {
  return escolherTitulo([metaTitle, `Consultar Placa de ${nome}: Leilão e FIPE`])
}
