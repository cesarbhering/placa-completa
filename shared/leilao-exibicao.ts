// O que o card de leilao do relatorio pago MOSTRA de cada passagem.
//
// Decisao do Cesar (01/out): por enquanto NENHUM valor em R$ (venda, lance,
// avaliacao). E filtro de EXIBICAO: vale tambem pra snapshot antigo, que ainda
// traz valor/valor_final gravados.

// O que a fonte expoe sobre o ESTADO DO VEICULO, e so isso. A lista e curada
// de proposito: com dado real, cada passagem vinha tambem com "status:
// encerrado" e "subcategoria: Hatches", que nao dizem nada sobre o carro.
// Chave fora da lista e ignorada; a ordem aqui e a ordem da tela. valor_final
// SAIU (sem R$ no card).
export const ROTULO_DETALHE: Record<string, string> = {
  sucata: 'Sucata',
  monta: 'Monta',
  sinistro: 'Sinistro',
  dano: 'Dano',
  condicao: 'Condição',
  km: 'Quilometragem',
  patio: 'Pátio',
  desfecho: 'Desfecho',
  observacao: 'Observação',
}
const ORDEM_DETALHE = Object.keys(ROTULO_DETALHE)

const TEM_REAIS = /R\$\s*\d|\d\s*reais\b/i

/**
 * Tira do texto os trechos com valor em reais ("Lance inicial: R$ 12.000,00").
 * Corta por frase/separador e descarta o trecho inteiro que tiver R$; se nao
 * sobrar nada, null.
 */
export function semValorEmReais(texto: unknown): string | null {
  const s = String(texto ?? '').trim()
  if (!s) return null
  if (!TEM_REAIS.test(s)) return s
  const resto = s
    .split(/(?<=[;|·\n])\s*|(?<=\.)\s+|\s+-\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !TEM_REAIS.test(t))
    .join(' ')
    .replace(/\s*[;|·,-]\s*$/, '')
    .trim()
  return resto || null
}

export function detalhesLegiveis(bruto: unknown): { rotulo: string; valor: string }[] {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return []
  const dados = bruto as Record<string, unknown>
  const out: { rotulo: string; valor: string }[] = []
  for (const k of ORDEM_DETALHE) {
    const v = dados[k]
    if (v === null || v === undefined || v === '') continue
    const valor = typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : semValorEmReais(v)
    if (valor) out.push({ rotulo: ROTULO_DETALHE[k], valor })
  }
  return out
}
