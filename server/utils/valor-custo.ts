import { getRegiaoSusep } from './regiao-susep'
import { marcaExibicao } from '../../shared/marca-exibicao'
import { getSeguroEstimado } from './seguro-estimate'
import { calcularICV5, inferirCategoria } from './icv5'
import { escolherMelhorFipe, type FipeMelhorCandidatoResultado } from './fipe-candidato'

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

function pontos(historyData: any, anoModelo: string | number) {
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

export async function getValorCusto(
  placa: string,
  uf?: string | null,
  municipio?: string | null,
  fipeCandidatoOpts?: { senatran: FatosSenatranFipe; ativo: boolean; segmento?: Segmento },
): Promise<ValorCusto | null> {
  const config = useRuntimeConfig()
  if (!config.placaApiToken) return null

  // Via cache (placa_cache): reaproveita a resposta da wdapi ja obtida na
  // consulta/preview da mesma placa. Ver server/utils/placa-lookup.ts.
  const dados = await consultarPlacaWdapi(placa)
  if (!dados) return null
  const lista = dados?.fipe?.dados
  if (!lista?.length) return null

  let melhor: any = lista.reduce((b: any, i: any) => ((i.score || 0) > (b.score || 0) ? i : b), lista[0])
  let fipeCandidato: ValorCusto['fipeCandidato'] = null

  // Melhor candidato via funil + Haiku: SO no fluxo pago (opts.ativo), com
  // fail-open total - qualquer problema aqui e `melhor` continua sendo o
  // score da wdapi de sempre.
  if (fipeCandidatoOpts?.ativo) {
    try {
      const resultado = await escolherMelhorFipe({
        senatran: fipeCandidatoOpts.senatran,
        wdapi: dados,
        fipeApiUrl: config.fipeApiUrl,
        fipeApiToken: config.fipeApiToken,
        anthropicApiKey: config.anthropicApiKey,
      })
      // AMBIGUO NAO VIRA VALOR. Antes, quando o juiz respondia com confianca
      // baixa, o candidato dele substituia o melhor score da fonte livre e ia
      // pra tela como se fosse a FIPE do veiculo. Foi assim que uma scooter
      // 150 apareceu valendo R$58 mil, com o custo de cinco anos calculado em
      // cima disso. Sem certeza, o relatorio mantem o candidato de sempre e a
      // tela avisa que a versao nao foi identificada.
      const ambiguo = resultado.decididoPor === 'ambiguo' || resultado.confianca === 'baixa'
      if (!ambiguo && resultado.decididoPor !== 'fallback' && resultado.escolhido) {
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

  const fipe = melhor?.texto_valor || null
  const valorFipe = fipe ? parseFloat(String(fipe).replace(/[^\d,]/g, '').replace(',', '.')) : NaN
  const anoModelo = dados.anoModelo || dados.ano || null

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
      marca: marcaExibicao(dados),
      modelo: dados.MODELO || dados.modelo || '',
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
        anoFabricacao: parseInt(String(dados.ano), 10) || new Date().getFullYear(),
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
