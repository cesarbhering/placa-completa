import { filtrarPorPlano, camposRestantes } from '../../shared/planos'

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
  pedido: { placa: string; plano: string; consulta_id: string | null; preview?: any },
): Promise<RelatorioSnapshot> {
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
  // Melhor candidato FIPE (funil + Haiku): so no fluxo pago, e so quando a
  // consulta trouxe o registro SENATRAN pra tirar cilindrada/carroceria dele.
  // Ver docs/feat-fipe-melhor-candidato.md.
  const senatranBruto = Array.isArray(consulta?.response) ? consulta?.response?.[0] : consulta?.response
  const valorCusto = await getValorCusto(pedido.placa, local.uf, local.municipio, {
    ativo: true,
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
  if (pedido.plano === 'completa' && consulta?.response?.chassi) {
    chassiOrigem = await decodificarChassi(consulta.response.chassi).catch(() => null)
    // O digito de ano do VIN se repete a cada 30 anos e o decoder, sozinho,
    // sempre chuta o ciclo mais recente (um Civic 1995 virava "2025"). Aqui
    // temos o ano do registro, entao o ciclo certo e escolhido; sem candidato
    // proximo, o ano sai do relatorio em vez de contradizer o registro.
    chassiOrigem = corrigirAnoChassi(
      chassiOrigem,
      senatranBruto?.anoModelo ?? senatranBruto?.anoFabricacao ?? null,
    )
  }

  return { consulta, camposRestantes: restantes, valorCusto, chassiOrigem }
}
