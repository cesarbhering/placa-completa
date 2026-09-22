import { filtrarPorPlano, camposRestantes } from '../../shared/planos'
import { marcaExibicao } from '../../shared/marca-exibicao'
import type { RecallDetalhe } from './recall-detalhe'
import type { MultasDetalhe } from './detran-multas'

// Monta o payload agregado do relatorio (consulta filtrada por plano +
// valorCusto + chassiOrigem + camposRestantes) — o mesmo bloco que report.get
// servia remontando a cada visualizacao. Usado tanto na gravacao do snapshot
// (na entrega) quanto no fallback lazy (backfill de pedido entregue antigo).
//
// NAO inclui campos volateis de fluxo (status/brCode/expiraEm): aqueles
// continuam dinamicos e vem de fora do snapshot, sempre lidos do pedido atual.
export interface RelatorioSnapshot {
  consulta: { placa: string; response: any; created_at?: string } | null
  camposRestantes: number
  valorCusto: Awaited<ReturnType<typeof getValorCusto>>
  chassiOrigem: Awaited<ReturnType<typeof decodificarChassi>> | null
  /** null quando o servico nao esta configurado (prod hoje) ou nao respondeu. */
  historicoLeilao: Awaited<ReturnType<typeof consultarHistoricoLeilao>> | null
  /** carro, moto, caminhao: muda checagem, copy e o que faz sentido estimar. */
  segmento: Segmento
  /**
   * Detalhe do recall pendente. null quando nao ha recall, quando a busca nao
   * respondeu a tempo ou quando o servico nao esta configurado: nesses casos o
   * relatorio mostra o indicador vermelho de sempre, so sem o detalhe.
   */
  recall?: RecallDetalhe | null
  /**
   * Debitos e restricoes do orgao de transito estadual (SP hoje). Como o recall,
   * e escrito DEPOIS da entrega por uma busca solta: null quando nao ha multa,
   * quando a busca nao respondeu a tempo ou quando o servico nao esta
   * configurado. Nesses casos o relatorio mostra so o indicador de sempre.
   */
  multas?: MultasDetalhe | null
}

// O registro traz "MARCA/MODELO" numa string so ("I/HONDA CIVIC LX"). A API de
// leiloes casa melhor com os dois separados, e a marca importada precisa do
// mesmo tratamento que o resto do relatorio ja da (ver shared/marca-exibicao).
function marcaDoRegistro(bruto: any): string | null {
  const desc = String(bruto?.descricaoMarcaModelo || '').trim()
  if (!desc) return null
  return marcaExibicao({ MARCA: desc.split('/')[0], MODELO: desc, marcaModelo: desc }) || null
}

function modeloDoRegistro(bruto: any): string | null {
  const desc = String(bruto?.descricaoMarcaModelo || '').trim()
  if (!desc) return null
  // Tira o prefixo de importado e o token da marca, sobra o modelo.
  const semImportado = desc.replace(/^(?:IMP|IMPORT|I)\s*\//i, '').trim()
  const partes = semImportado.split('/')
  const resto = partes.length > 1 ? partes.slice(1).join('/') : semImportado.split(/\s+/).slice(1).join(' ')
  return resto.trim() || null
}

// Local do VEICULO (nao de quem abre o link): mora dentro do preview salvo no
// pedido desde o checkout. Duplicado aqui (era local a report.get.ts) porque
// agora tanto a gravacao quanto o servico lazy precisam disto.
function localDoVeiculo(preview: any): { uf: string | null; municipio: string | null } {
  if (!preview || typeof preview !== 'object') return { uf: null, municipio: null }
  return {
    uf: typeof preview.uf === 'string' ? preview.uf : null,
    municipio: typeof preview.municipio === 'string' ? preview.municipio : null,
  }
}

export async function montarRelatorioSnapshot(
  supabase: any,
  pedido: {
    placa: string; plano: string; consulta_id: string | null; preview?: any
    /** Ja buscado na entrega: o snapshot so guarda o que veio. */
    recall?: RecallDetalhe | null
    /** Idem recall: ja buscado na entrega, o snapshot so guarda o que veio. */
    multas?: MultasDetalhe | null
  },
  // Backfill de UM campo que falhou na entrega (ver relatorio-lazy-fill.ts):
  // limita o trabalho ao que foi pedido. Sem isto, reabrir um relatorio sem
  // origem do chassi refaria tambem o julgamento FIPE, que custa uma chamada
  // de modelo por relatorio. Omitido = monta tudo, como na entrega.
  apenas?: Array<'chassiOrigem' | 'valorCusto' | 'historicoLeilao'>,
): Promise<RelatorioSnapshot> {
  const querem = (campo: 'chassiOrigem' | 'valorCusto' | 'historicoLeilao') => !apenas || apenas.includes(campo)
  let consulta: RelatorioSnapshot['consulta'] = null
  let restantes = 0
  if (pedido.consulta_id) {
    const { data } = await supabase
      .from('senatran_consultas')
      .select('response,placa,created_at')
      .eq('id', pedido.consulta_id)
      .single()
    if (data) {
      restantes = camposRestantes(data.response, pedido.plano)
      consulta = { ...data, response: filtrarPorPlano(data.response, pedido.plano) }
    }
  }

  const local = localDoVeiculo(pedido.preview)
  const senatranParaSegmento = Array.isArray(consulta?.response) ? consulta?.response?.[0] : consulta?.response
  const segmento = detectarSegmento({
    wdapi: pedido.preview,
    senatran: senatranParaSegmento,
    chassi: senatranParaSegmento?.chassi,
  })
  // Melhor candidato FIPE (funil + Haiku): so no fluxo pago, e so quando a
  // consulta trouxe o registro SENATRAN pra tirar cilindrada/carroceria dele.
  // Ver docs/feat-fipe-melhor-candidato.md.
  const senatranBruto = Array.isArray(consulta?.response) ? consulta?.response?.[0] : consulta?.response
  const valorCusto = !querem('valorCusto') ? null : await getValorCusto(pedido.placa, local.uf, local.municipio, {
    ativo: true,
    segmento,
    senatran: {
      cilindrada: senatranBruto?.cilindrada ?? null,
      potencia: senatranBruto?.potencia ?? null,
      descricaoMarcaModelo: senatranBruto?.descricaoMarcaModelo ?? null,
      anoModelo: senatranBruto?.anoModelo ?? null,
    },
  }).catch(() => null)

  // Origem do chassi (decode de VIN): exclusivo da completa (decisao de
  // produto, ver report.get.ts historico). Fail-open: erro/fora do ar = sem
  // bloco, snapshot segue normal.
  let chassiOrigem: RelatorioSnapshot['chassiOrigem'] = null
  // Le o chassi de senatranBruto, nao de consulta.response: a resposta pode
  // vir achatada num array de um elemento, e ai `response.chassi` e undefined
  // e o bloco sumia sem nem chamar o decoder.
  if (querem('chassiOrigem') && pedido.plano === 'completa' && senatranBruto?.chassi) {
    chassiOrigem = await decodificarChassi(senatranBruto.chassi).catch(() => null)
    // O digito de ano do VIN se repete a cada 30 anos e o decoder, sozinho,
    // sempre chuta o ciclo mais recente (um Civic 1995 virava "2025"). Aqui
    // temos o ano do registro, entao o ciclo certo e escolhido; sem candidato
    // proximo, o ano sai do relatorio em vez de contradizer o registro.
    chassiOrigem = corrigirAnoChassi(
      chassiOrigem,
      senatranBruto?.anoModelo ?? senatranBruto?.anoFabricacao ?? null,
    )
  }

  // Historico de passagem por leilao: exclusivo da completa, pela mesma regra
  // de produto do bloco de origem do chassi. Roda so onde o servico esta
  // configurado (hoje, homolog); em prod a env nao existe e a consulta nem
  // acontece. Fail-open: erro ou timeout = relatorio sem a secao.
  let historicoLeilao: RelatorioSnapshot['historicoLeilao'] = null
  if (querem('historicoLeilao') && pedido.plano === 'completa' && consulta?.response) {
    historicoLeilao = await consultarHistoricoLeilao({
      placa: pedido.placa,
      chassi: senatranBruto?.chassi ?? null,
      renavam: senatranBruto?.renavam ?? null,
      // Motor: nenhuma fonte nossa expoe esse numero. O registro do veiculo
      // devolve 34 campos e nenhum e o motor; a fonte livre tem a chave, mas
      // vem vazia (0 de 5.555 consultas salvas em producao). O campo fica no
      // contrato porque pode chegar de outra fonte um dia, e enquanto isso o
      // ramo motor-only da API de leiloes (cerca de 144 mil veiculos, PR e RS
      // antigos) permanece invisivel pra gente.
      motor: null,
      marca: marcaDoRegistro(senatranBruto),
      modelo: modeloDoRegistro(senatranBruto),
      // Os dois anos separados: a API compara fabricacao com fabricacao e
      // modelo com modelo. Mandar um so fazia um veiculo 2019/2020 casar com
      // lote 2020/2020, que e outra moto (caso real, CDR2189). `ano` continua
      // indo por compatibilidade com a versao anterior da API.
      ano: senatranBruto?.anoModelo ?? senatranBruto?.anoFabricacao ?? null,
      ano_fab: senatranBruto?.anoFabricacao ?? null,
      ano_mod: senatranBruto?.anoModelo ?? null,
      cor: senatranBruto?.descricaoCor ?? null,
      uf: senatranBruto?.ufJurisdicao ?? local.uf ?? null,
    }).catch(() => null)
  }

  return { consulta, camposRestantes: restantes, valorCusto, chassiOrigem, historicoLeilao, segmento, recall: pedido.recall ?? null, multas: pedido.multas ?? null }
}
