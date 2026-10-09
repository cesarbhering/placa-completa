import { cambioDaVersaoFipe, type Cambio } from '../../shared/cambio-nome'

// Camada 3 da desambiguacao manual x automatico: o cliente toca no cambio do
// carro dele e o relatorio passa a usar AQUELA versao (valor, historico,
// queda, seguro). A escolha fica gravada no pedido (snapshot.valorCusto
// .fipeEscolhaCliente) e vira dado de treino da camada 2 (chassi -> cambio).

export const MAX_TROCAS = 6

export interface EscolhaFipe {
  codigo_fipe: string
  modelo: string
  cambio: Cambio | null
  em: string
  trocas: number
}

/**
 * Valida o pedido de escolha contra o snapshot: so versao da shortlist do
 * proprio relatorio, so quando a FIPE ficou em duvida (ou ja havia escolha),
 * e com teto de trocas. Devolve o candidato ou o motivo da recusa.
 */
export function validarEscolha(snapshot: any, codigo: string): { ok: true; candidato: { codigo_fipe: string; modelo: string; valor: number | null } } | { ok: false; motivo: string } {
  if (!/^\d{6}-\d$/.test(String(codigo || ''))) return { ok: false, motivo: 'codigo invalido' }
  const vc = snapshot?.valorCusto
  const fc = vc?.fipeCandidato
  const candidatos: any[] = Array.isArray(fc?.candidatos) ? fc.candidatos : []
  const c = candidatos.find((x) => x?.codigo_fipe === codigo)
  if (!c?.modelo) return { ok: false, motivo: 'fora da lista' }
  const emDuvida = fc?.decididoPor === 'ambiguo' || fc?.confianca === 'baixa' || (!!vc?.fipeNaoLocalizado && candidatos.length > 1)
  if (!emDuvida && !vc?.fipeEscolhaCliente) return { ok: false, motivo: 'fipe ja decidida' }
  if ((vc?.fipeEscolhaCliente?.trocas ?? 0) >= MAX_TROCAS) return { ok: false, motivo: 'limite de trocas' }
  return { ok: true, candidato: { codigo_fipe: String(c.codigo_fipe), modelo: String(c.modelo), valor: typeof c.valor === 'number' ? c.valor : null } }
}

/**
 * Novo valorCusto: o calculado pra versao escolhida, mantendo a shortlist
 * original (fipeCandidato) pra tela poder oferecer a troca, e a escolha.
 */
export function aplicarEscolha(vcAntigo: any, vcNovo: any, candidato: { codigo_fipe: string; modelo: string }, agora = new Date()): any {
  const anterior = vcAntigo?.fipeEscolhaCliente
  const escolha: EscolhaFipe = {
    codigo_fipe: candidato.codigo_fipe,
    modelo: candidato.modelo,
    cambio: cambioDaVersaoFipe(candidato.modelo),
    em: agora.toISOString(),
    trocas: (anterior?.trocas ?? 0) + (anterior ? 1 : 0),
  }
  const { fipeNaoLocalizado: _x, ...resto } = vcNovo || {}
  return { ...resto, fipeCandidato: vcAntigo?.fipeCandidato ?? null, fipeEscolhaCliente: escolha }
}
