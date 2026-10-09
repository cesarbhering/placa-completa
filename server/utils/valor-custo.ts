import { getRegiaoSusep } from './regiao-susep'
import { filtrarPeloNomeDoVeiculo } from '../../shared/versao-fipe'
import { marcaExibicao } from '../../shared/marca-exibicao'
import { getSeguroEstimado } from './seguro-estimate'
import { calcularICV5, inferirCategoria } from './icv5'
import { escolherMelhorFipe, marcaDoRegistro, marcaParaFipeApi, comCodigoModelo, tabelaFipe, candidatoDaTabela, nomeDoModelo, type FipeMelhorCandidatoResultado } from './fipe-candidato'

// Valor FIPE, historico de depreciacao, seguro estimado e custo em 5 anos.
//
// Saiu da consulta gratis e virou conteudo pago, entao o relatorio precisa
// entregar. Vive aqui, fora do handler da consulta, porque agora dois fluxos
// pedem a mesma coisa e a versao antiga estava soldada no meio de
// consulta.post.ts (dependia de flags de PWA e do IP de quem consultava).
//
// A UF vem do veiculo, nao do IP: e o dado certo pro calculo, e no relatorio
// quem abre pode nao ser quem consultou.

export type ValorCusto = {
  fipe: string | null
  fipeModelo: string | null
  /** Codigo FIPE da versao que deu o valor exibido (ex.: 004473-3). */
  fipeCodigo?: string | null
  historico: { label: string; price: number }[] | null
  quedaAno: number | null      // % de variacao nos ultimos 12 meses
  seguroAnual: number | null
  percentualFipe: number | null
  custo5anos: number | null
  // So preenchido no fluxo pago (ver docs/feat-fipe-melhor-candidato.md):
  // auditoria de como o modelo FIPE foi escolhido, e shortlist quando
  // ambiguo (a UI mostra "versoes compativeis" em vez de afirmar errado).
  fipeCandidato?: {
    decididoPor: FipeMelhorCandidatoResultado['decididoPor']
    confianca?: FipeMelhorCandidatoResultado['confianca']
    candidatos: { codigo_fipe: string; modelo: string; valor: number | null }[]
  } | null
  /**
   * A fonte veio sem FIPE e o funil nao achou versao com confianca alta: a
   * ficha diz "Valor FIPE: nao localizado para esta versao" em vez de sumir.
   */
  fipeNaoLocalizado?: boolean
  /** Versao indicada pelo cliente na tela (camada 3, server/utils/fipe-escolha.ts). */
  fipeEscolhaCliente?: { codigo_fipe: string; modelo: string; cambio: 'manual' | 'automatico' | null; em: string; trocas: number } | null
}

// Fatos do SENATRAN usados pelo funil do melhor-candidato. So disponiveis no
// fluxo pago (a consulta gratis nao tem SENATRAN).
export interface FatosSenatranFipe {
  cilindrada?: number | string | null
  potencia?: number | string | null
  descricaoMarcaModelo?: string | null
  anoModelo?: number | string | null
  /** Codigo de combustivel do registro (RENAVAM). So desempata diesel/eletrico. */
  codigoCombustivel?: number | string | null
  /** Usados so pra saber se e moto: o funil de carro nao vale pra duas rodas. */
  descricaoTipoVeiculo?: string | null
  descricaoEspecie?: string | null
  /**
   * Camada 2: cambio vindo de um sinal externo (texto do recall) quando a
   * descricao do registro nao tem MT/AT. So desempata o empate de cambio.
   */
  transmissaoHint?: 'manual' | 'automatico' | null
}

function formatarReais(valor: number | null): string | null {
  if (!Number.isFinite(valor as number)) return null
  return (valor as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function pontos(historyData: any, anoModelo: string | number) {
  if (!historyData?.price_history?.length) return null
  const anoStr = String(anoModelo)
  let entries = historyData.price_history.find((h: any) => String(h.year) === anoStr)
  // Sem o ano-modelo EXATO, sem grafico: cair no price_history[0] mostrava a
  // serie de OUTRO ano (em geral o 0 km) como se fosse a deste carro.
  if (!entries) return null
  if (!entries?.prices?.length) return null

  const ordenado = [...entries.prices].sort((a: any, b: any) =>
    new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime())

  // A serie vai INTEIRA: o grafico do relatorio tem zoom, e zoom em serie
  // reamostrada nao revela nada. Quem precisa de poucos pontos (o grafico do
  // e-mail/PWA) tem o proprio reamostrador em consulta.post.ts.
  const pts = ordenado
    .filter((h: any) => typeof h.price === 'number' && h.price > 0)
    .map((h: any) => ({ label: `${MESES[h.month - 1]}/${String(h.year).slice(2)}`, price: h.price }))
  return pts.length > 1 ? pts : null
}

/**
 * Quando o candidato do funil vira o valor exibido. Com FIPE na fonte: tudo
 * que nao e ambiguo nem fallback (regra de sempre). SEM FIPE na fonte: so
 * confianca ALTA, porque nao ha o candidato da fonte pra conferir.
 */
export function aceitaCandidatoFipe(
  r: Pick<FipeMelhorCandidatoResultado, 'decididoPor' | 'confianca' | 'escolhido'>,
  semFipeNaFonte: boolean,
): boolean {
  const ambiguo = r.decididoPor === 'ambiguo' || r.confianca === 'baixa'
  if (ambiguo || r.decididoPor === 'fallback' || !r.escolhido) return false
  return semFipeNaFonte ? r.confianca === 'alta' : true
}

export async function getValorCusto(
  placa: string,
  uf?: string | null,
  municipio?: string | null,
  fipeCandidatoOpts?: {
    senatran: FatosSenatranFipe; ativo: boolean; segmento?: Segmento
    /** Versao escolhida pelo cliente na tela (camada 3): pula o funil e usa esta. */
    forcar?: { codigo_fipe: string; modelo: string; valor: number | null } | null
  },
): Promise<ValorCusto | null> {
  const config = useRuntimeConfig()
  if (!config.placaApiToken) return null

  // Via cache (placa_cache): reaproveita a resposta da wdapi ja obtida na
  // consulta/preview da mesma placa. Ver server/utils/placa-lookup.ts.
  const dadosWdapi = await consultarPlacaWdapi(placa)
  // So os candidatos da tabela FIPE do veiculo (carros, motos ou caminhoes):
  // a fonte livre ja mandou Touareg e Amarok pra um caminhao VW (PUF7J27).
  // Van registrada como caminhao (Master) segue valendo pelo nome do modelo.
  const tabela = tabelaFipe(fipeCandidatoOpts?.senatran ?? null, dadosWdapi, fipeCandidatoOpts?.segmento)
  const nome = nomeDoModelo(fipeCandidatoOpts?.senatran ?? null, dadosWdapi)
  const lista = Array.isArray(dadosWdapi?.fipe?.dados)
    ? dadosWdapi.fipe.dados.filter((d: any) => candidatoDaTabela(d?.codigo_fipe, d?.texto_modelo, tabela, nome))
    : null
  // Fonte sem FIPE (fipe.dados vazio, caso FUG0A96) ou sem resposta: so o
  // fluxo pago tenta resolver pela tabela FIPE (marca + modelo + ano do
  // registro, mesmo funil de candidatos), e so aceita confianca alta.
  const semFipeNaFonte = !lista?.length
  if (semFipeNaFonte && !fipeCandidatoOpts?.ativo) return null
  const dados: any = dadosWdapi || {}

  // Melhor score da fonte entre os que batem com o nome do registro (modelo,
  // cabine, versao): e o valor que fica quando o funil nao roda ou cai no
  // fallback. Cada filtro volta a lista de antes quando zera.
  const candidatosDoNome = semFipeNaFonte ? [] : filtrarPeloNomeDoVeiculo(lista!, fipeCandidatoOpts?.senatran?.descricaoMarcaModelo, (d: any) => String(d?.texto_modelo || ''))
  let melhor: any = semFipeNaFonte ? null : candidatosDoNome.reduce((b: any, i: any) => ((i.score || 0) > (b.score || 0) ? i : b), candidatosDoNome[0])
  let fipeCandidato: ValorCusto['fipeCandidato'] = null

  // Melhor candidato via funil + Haiku: SO no fluxo pago (opts.ativo), com
  // fail-open total - qualquer problema aqui e `melhor` continua sendo o
  // score da wdapi de sempre.
  if (fipeCandidatoOpts?.forcar) {
    // Escolha do cliente (manual x automatico): valor, historico, queda e
    // seguro passam a ser os DESTA versao. codigo_modelo: o da fonte livre se
    // ela trouxe essa versao; senao, resolvido pelo nome na fipe-api.
    const f = fipeCandidatoOpts.forcar
    const daFonte = (Array.isArray(dadosWdapi?.fipe?.dados) ? dadosWdapi.fipe.dados : []).find((d: any) => d?.codigo_fipe === f.codigo_fipe)
    let codigoModelo: string | null = daFonte?.codigo_modelo ? String(daFonte.codigo_modelo) : null
    if (!codigoModelo) {
      const marca = marcaParaFipeApi(marcaDoRegistro(fipeCandidatoOpts.senatran?.descricaoMarcaModelo) || marcaExibicao(dados), tabela)
      try {
        codigoModelo = (await comCodigoModelo({ codigo_fipe: f.codigo_fipe, modelo: f.modelo, valor: f.valor, texto_valor: null, combustivel: null, mes_referencia: null }, marca, config.fipeApiUrl, config.fipeApiToken)).codigoModelo || null
      } catch { codigoModelo = null }
    }
    melhor = { codigo_fipe: f.codigo_fipe, codigo_modelo: codigoModelo, texto_modelo: f.modelo, texto_valor: daFonte?.texto_valor || formatarReais(f.valor) }
  } else if (fipeCandidatoOpts?.ativo) {
    try {
      const resultado = await escolherMelhorFipe({
        senatran: fipeCandidatoOpts.senatran,
        wdapi: dados,
        fipeApiUrl: config.fipeApiUrl,
        fipeApiToken: config.fipeApiToken,
        anthropicApiKey: config.anthropicApiKey,
        segmento: fipeCandidatoOpts.segmento ?? null,
      })
      // AMBIGUO NAO VIRA VALOR. Antes, quando o juiz respondia com confianca
      // baixa, o candidato dele substituia o melhor score da fonte livre e ia
      // pra tela como se fosse a FIPE do veiculo. Foi assim que uma scooter
      // 150 apareceu valendo R$58 mil, com o custo de cinco anos calculado em
      // cima disso. Sem certeza, o relatorio mantem o candidato de sempre e a
      // tela avisa que a versao nao foi identificada.
      if (aceitaCandidatoFipe(resultado, semFipeNaFonte) && resultado.escolhido) {
        // codigoModelo ja vem resolvido do fipe-candidato.ts (direto da wdapi
        // quando o candidato e dela, ou buscado sob demanda na fipe-api
        // quando nao e) - e o que price-history/seguro usam abaixo. Sem ele
        // (falhou a resolucao), so historico/seguro ficam nulos - fail-open,
        // valor FIPE e o resto do relatorio continuam valendo.
        melhor = {
          codigo_fipe: resultado.escolhido.codigo_fipe,
          codigo_modelo: resultado.escolhido.codigoModelo || null,
          texto_modelo: resultado.escolhido.modelo,
          texto_valor: resultado.escolhido.texto_valor || formatarReais(resultado.escolhido.valor),
          combustivel: resultado.escolhido.combustivel,
          mes_referencia: resultado.escolhido.mes_referencia,
        }
      }
      // Grava a decisao SEMPRE que o funil rodou (menos fallback puro, que e
      // o comportamento antigo e nao tem nada de novo pra auditar) - inclusive
      // regra-com-1-sobrevivente, pra metrica de quanto o funil resolve sem
      // Haiku. candidatos fica com so o escolhido nesse caso (nao e shortlist
      // de ambiguidade, e log de auditoria).
      // Ambiguo ou confianca baixa: nem o candidato da fonte vale. O valor,
      // o modelo e o historico ficam vazios e o relatorio diz que a versao
      // FIPE nao foi identificada. Valor errado e pior que valor nenhum.
      if (resultado.decididoPor === 'ambiguo' || resultado.confianca === 'baixa') melhor = null
      if (resultado.decididoPor !== 'fallback') {
        fipeCandidato = {
          decididoPor: resultado.decididoPor,
          confianca: resultado.confianca,
          candidatos: resultado.candidatos.map((c) => ({ codigo_fipe: c.codigo_fipe, modelo: c.modelo, valor: c.valor })),
        }
      }
    } catch (err) {
      console.error('[valor-custo] fipe-candidato falhou, mantendo score wdapi:', err)
    }
  }

  if (!melhor) {
    return {
      fipe: null, fipeModelo: null, fipeCodigo: null, historico: null, quedaAno: null,
      seguroAnual: null, percentualFipe: null, custo5anos: null,
      fipeCandidato, fipeNaoLocalizado: true,
    }
  }

  const fipe = melhor?.texto_valor || null
  const valorFipe = fipe ? parseFloat(String(fipe).replace(/[^\d,]/g, '').replace(',', '.')) : NaN
  const anoModelo = dados.anoModelo || dados.ano || fipeCandidatoOpts?.senatran?.anoModelo || null

  // historico + id do modelo (o id so existe nessa chamada, e o seguro precisa dele)
  let historico: ValorCusto['historico'] = null
  let fipeModelId: number | null = null
  if (melhor?.codigo_modelo) {
    try {
      const bruto = await $fetch<any>(
        `${config.fipeApiUrl}/models/fipe/${melhor.codigo_modelo}/price-history`,
        { headers: { Authorization: `Bearer ${config.fipeApiToken}` } },
      )
      const norm = bruto?.data || bruto
      fipeModelId = norm?.model?.id ?? null
      historico = pontos(norm, anoModelo)
    } catch { /* fail-open: sem historico o resto continua valendo */ }
  }

  const quedaAno = historico && historico.length > 1
    ? Math.round(((historico[historico.length - 1].price - historico[0].price) / historico[0].price) * 1000) / 10
    : null

  let seguroAnual: number | null = null
  let percentualFipe: number | null = null
  const anoNum = parseInt(String(anoModelo || ''), 10)
  if (fipeModelId && anoNum) {
    // Com o municipio a regiao SUSEP e mais precisa; sem ele cai no padrao da UF.
    const regiao = uf ? getRegiaoSusep(uf, municipio) : null
    const est = await getSeguroEstimado({
      fipeModelId,
      ano: anoNum,
      regiaoCode: regiao?.code ?? null,
      marca: marcaExibicao(dados) || marcaDoRegistro(fipeCandidatoOpts?.senatran?.descricaoMarcaModelo),
      modelo: dados.MODELO || dados.modelo || String(fipeCandidatoOpts?.senatran?.descricaoMarcaModelo || '').split('/').slice(1).join('/'),
    })
    if (est) {
      seguroAnual = est.premioAnual
      if (Number.isFinite(valorFipe) && valorFipe > 1000) {
        percentualFipe = Math.round((est.premioAnual / valorFipe) * 1000) / 10
      }
    }
  }

  // Custo de cinco anos e conta de AUTOMOVEL: aliquota de IPVA de passeio,
  // piso de manutencao de carro e fator por carroceria. Numa moto isso infla o
  // numero de forma grosseira (uma 150cc nao paga manutencao de sedan), entao o
  // relatorio prefere nao mostrar a mostrar errado. Mesma regra pra caminhao.
  const segmento = fipeCandidatoOpts?.segmento ?? 'carro'
  const podeEstimarCusto = aceitaCustoDeCarro(segmento)

  let custo5anos: number | null = null
  if (podeEstimarCusto && uf && Number.isFinite(valorFipe) && valorFipe > 0) {
    try {
      const extra = dados.extra || {}
      custo5anos = calcularICV5({
        valorFipe,
        anoFabricacao: parseInt(String(dados.ano || anoModelo), 10) || new Date().getFullYear(),
        uf,
        categoria: inferirCategoria(extra.sub_segmento || '', extra.combustivel || ''),
      })?.custoTotal5anos ?? null
    } catch { /* fail-open */ }
  }

  return {
    fipe,
    fipeModelo: melhor?.texto_modelo || null,
    fipeCodigo: melhor?.codigo_fipe ? String(melhor.codigo_fipe) : null,
    historico,
    quedaAno,
    seguroAnual,
    percentualFipe,
    custo5anos,
    fipeCandidato,
  }
}
