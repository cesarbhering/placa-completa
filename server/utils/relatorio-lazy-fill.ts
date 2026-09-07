// Um relatorio ja vendido e imutavel: o snapshot guarda exatamente o que a
// pessoa comprou. Mas quando um servico auxiliar estava fora do ar ou lento na
// hora da entrega, o snapshot congelou um BURACO, nao um dado. Isso nao e o que
// ela comprou, e sim o que a nossa infra falhou em entregar.
//
// Entao: campo vazio por falha e preenchido na proxima abertura do relatorio, e
// so ele (jsonb_set no campo, sem tocar em mais nada). Cada campo e tentado UMA
// vez; o marcador `<campo>_em` fica gravado mesmo quando a nova tentativa
// tambem volta vazia, senao um veiculo que legitimamente nao tem historico de
// leilao mandaria uma consulta nova a cada visualizacao, pra sempre.

export type CampoLazy = 'chassiOrigem' | 'valorCusto' | 'historicoLeilao'

export function marcadorDe(campo: CampoLazy): string {
  return `${campo}_em`
}

/**
 * Quais campos vale a pena tentar de novo neste snapshot. Nao inclui campo que
 * ja tem valor, nem campo ja tentado antes, nem campo que nao faz sentido pro
 * plano (a basica nao compra origem do chassi nem historico de leilao) ou pro
 * pedido (sem chassi de 17 caracteres nao ha o que decodificar).
 */
export function camposLazyPendentes(snap: any, plano: string): CampoLazy[] {
  if (!snap || typeof snap !== 'object') return []
  const bruto = Array.isArray(snap.consulta?.response) ? snap.consulta?.response?.[0] : snap.consulta?.response
  if (!bruto) return []

  const pendentes: CampoLazy[] = []
  const naoTentado = (c: CampoLazy) => snap[c] == null && !snap[marcadorDe(c)]

  const chassi = String(bruto.chassi || '').trim()
  if (plano === 'completa' && chassi.length === 17 && naoTentado('chassiOrigem')) {
    pendentes.push('chassiOrigem')
  }
  if (plano === 'completa' && naoTentado('historicoLeilao')) {
    pendentes.push('historicoLeilao')
  }
  if (naoTentado('valorCusto')) {
    pendentes.push('valorCusto')
  }
  return pendentes
}

/**
 * Roda as tentativas e grava campo a campo. Fail-open em tudo: qualquer erro
 * deixa o relatorio exatamente como esta hoje, que e sair sem a secao.
 *
 * Reaproveita montarRelatorioSnapshot em vez de repetir a montagem de cada
 * campo: o que preenche na entrega e o que preenche depois precisa ser o mesmo
 * codigo, senao um dia divergem e o relatorio antigo passa a mostrar algo que o
 * novo nao mostraria.
 */
export async function preencherCamposLazy(
  supabase: any,
  opts: {
    token: string
    snap: any
    plano: string
    placa: string
    consulta_id: string | null
    preview?: any
    campos: CampoLazy[]
  },
): Promise<Partial<Record<CampoLazy, any>>> {
  const resultado: Partial<Record<CampoLazy, any>> = {}
  let novo: any
  try {
    novo = await montarRelatorioSnapshot(supabase, {
      placa: opts.placa, plano: opts.plano, consulta_id: opts.consulta_id, preview: opts.preview,
    }, opts.campos)
  } catch (e: any) {
    console.warn('[lazy-fill] remontagem falhou (fail-open):', e?.message)
    return resultado
  }

  const agora = new Date().toISOString()
  for (const campo of opts.campos) {
    const valor = novo?.[campo] ?? null
    resultado[campo] = valor
    // Grava mesmo quando o valor voltou nulo: o marcador e o que impede a
    // proxima visualizacao de consultar tudo de novo.
    try {
      await supabase.rpc('preencher_snapshot_campo', {
        p_token: opts.token,
        p_campo: campo,
        p_valor: valor,
        p_marcador_em: agora,
      })
    } catch (e: any) {
      console.warn(`[lazy-fill] gravar ${campo} falhou (fail-open):`, e?.message)
    }
  }
  return resultado
}
