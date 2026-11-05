import type { LinhaLeilaoModelo } from '../../shared/gancho-modelo'

// Leitura da tabela leilao_modelos com cache em memoria de 24 h (a tabela muda
// uma vez por noite). Tabela inteira na memoria: e agregado por modelo, poucas
// mil linhas. Falha (tabela ainda nao criada, banco fora) = lista vazia por
// 5 min, e a tela simplesmente nao mostra a linha.

export const TTL_GANCHO_MS = 24 * 60 * 60 * 1000
const TTL_ERRO_MS = 5 * 60 * 1000
const PAGINA = 1000
const MAX_LINHAS = 20000

let cache: { em: number; ttl: number; lista: LinhaLeilaoModelo[] } | null = null
let emVoo: Promise<LinhaLeilaoModelo[]> | null = null

export function _zerarCacheGancho() { cache = null; emVoo = null }

async function carregar(supabase: any): Promise<{ lista: LinhaLeilaoModelo[]; ok: boolean }> {
  const lista: LinhaLeilaoModelo[] = []
  for (let de = 0; de < MAX_LINHAS; de += PAGINA) {
    const { data, error } = await supabase
      .from('leilao_modelos')
      .select('marca, modelo, qtd')
      .gt('qtd', 0)
      .order('id', { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) return { lista: [], ok: false }
    for (const r of data || []) lista.push({ marca: String(r.marca || ''), modelo: String(r.modelo || ''), qtd: Number(r.qtd) || 0 })
    if (!data || data.length < PAGINA) break
  }
  return { lista, ok: true }
}

export async function listaLeilaoModelos(supabase: any, agora = Date.now()): Promise<LinhaLeilaoModelo[]> {
  if (cache && agora - cache.em < cache.ttl) return cache.lista
  if (!emVoo) {
    emVoo = carregar(supabase)
      .catch(() => ({ lista: [] as LinhaLeilaoModelo[], ok: false }))
      .then(({ lista, ok }) => {
        // Lista vazia (tabela ainda sem carga, ou carga zerada) usa o TTL curto:
        // senao o primeiro acesso antes da carga das 01h40 congelava o gancho
        // desligado por 24 h (caso real, 05/nov/2026).
        cache = { em: agora, ttl: ok && lista.length > 0 ? TTL_GANCHO_MS : TTL_ERRO_MS, lista }
        return lista
      })
      .finally(() => { emVoo = null })
  }
  return emVoo
}
