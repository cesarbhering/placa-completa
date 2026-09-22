// ---------------------------------------------------------------------------
// Placa antiga <-> Mercosul (22/set/2026).
//
// Nasceu de um pedido pago que levou estorno: a consulta gratis achou a moto
// (RJH1218, formato antigo) e a consulta paga respondeu 404 "Veiculo nao
// encontrado" para RJH1C18. O registro converte antigo para Mercosul, mas nem
// sempre o contrario, entao perguntar pelo formato errado significa nao achar
// um veiculo que existe.
//
// A conversao mexe SO na quinta posicao: no Mercosul ela e a letra que
// corresponde ao digito da placa antiga (A=0, B=1, ... J=9). As outras seis
// posicoes sao iguais nos dois formatos.
// ---------------------------------------------------------------------------

const LETRAS = 'ABCDEFGHIJ'

export type FormatoPlaca = 'antiga' | 'mercosul'

/** Limpa e normaliza: "rjh-1218" vira "RJH1218". */
export function normalizarPlaca(v: unknown): string {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** LLLNNNN. */
const RE_ANTIGA = /^[A-Z]{3}\d{4}$/
/** LLLNLNN. */
const RE_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/

export function formatoDaPlaca(placa: unknown): FormatoPlaca | null {
  const p = normalizarPlaca(placa)
  if (RE_ANTIGA.test(p)) return 'antiga'
  if (RE_MERCOSUL.test(p)) return 'mercosul'
  return null
}

/**
 * A mesma placa no outro formato, ou null quando nao da pra converter (placa
 * fora dos dois padroes, ou letra fora de A-J na quinta posicao, que nao
 * corresponde a digito nenhum).
 */
export function placaEquivalente(placa: unknown): string | null {
  const p = normalizarPlaca(placa)
  const formato = formatoDaPlaca(p)
  if (formato === 'antiga') {
    const digito = Number(p[4])
    return p.slice(0, 4) + LETRAS[digito] + p.slice(5)
  }
  if (formato === 'mercosul') {
    const i = LETRAS.indexOf(p[4]!)
    if (i < 0) return null
    return p.slice(0, 4) + String(i) + p.slice(5)
  }
  return null
}

/**
 * Qual placa tentar depois de um "nao encontrado". Prefere a que a consulta
 * gratis devolveu (dado observado vale mais que conversao), e so cai na
 * conversao quando ela nao existe. Devolve null se a alternativa for a mesma
 * placa: repetir a consulta que ja falhou so gastaria outro hash.
 */
export function placaParaSegundaTentativa(placa: unknown, alternativaConhecida?: unknown): string | null {
  const p = normalizarPlaca(placa)
  const conhecida = normalizarPlaca(alternativaConhecida)
  const alvo = (conhecida && formatoDaPlaca(conhecida) ? conhecida : placaEquivalente(p)) || null
  if (!alvo || alvo === p) return null
  return alvo
}
