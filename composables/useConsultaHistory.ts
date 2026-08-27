// Historico local de consultas premium, guardado no localStorage do proprio
// navegador. Serve pro cliente "recuperar" relatorios que ja pagou ou concluir
// um pagamento que iniciou e nao terminou, sem login. NUNCA guarda dado
// sensivel do relatorio (isso fica server-side atras do token, que ja e a
// credencial): so o minimo pra religar o pedido.
export interface ConsultaLocal {
  token: string
  placa: string
  veiculo: string | null
  status: string
  criadoEm: string
  atualizadoEm: string
}

const KEY = 'pc_consultas_v1'
const MAX = 12

export function useConsultaHistory() {
  const itens = useState<ConsultaLocal[]>('pc-consulta-history', () => [])

  function ler(): ConsultaLocal[] {
    if (!import.meta.client) return []
    try {
      const raw = localStorage.getItem(KEY)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }

  function salvar(arr: ConsultaLocal[]) {
    const cortado = arr.slice(0, MAX)
    itens.value = cortado
    if (!import.meta.client) return
    try {
      localStorage.setItem(KEY, JSON.stringify(cortado))
    } catch {
      /* quota cheia ou modo privado: mantem so em memoria */
    }
  }

  // sincroniza o estado reativo com o localStorage (chamar no onMounted)
  function sync() {
    itens.value = ler()
  }

  function add(e: { token: string; placa: string; veiculo?: string | null; status?: string }) {
    const agora = new Date().toISOString()
    const arr = ler().filter((x) => x.token !== e.token)
    arr.unshift({
      token: e.token,
      placa: e.placa,
      veiculo: e.veiculo ?? null,
      status: e.status ?? 'aguardando_pagamento',
      criadoEm: agora,
      atualizadoEm: agora,
    })
    salvar(arr)
  }

  function updateStatus(token: string, status: string) {
    const arr = ler()
    const i = arr.findIndex((x) => x.token === token)
    if (i === -1) return
    arr[i] = { ...arr[i], status, atualizadoEm: new Date().toISOString() }
    salvar(arr)
  }

  function remove(token: string) {
    salvar(ler().filter((x) => x.token !== token))
  }

  function clear() {
    salvar([])
  }

  return { itens, sync, add, updateStatus, remove, clear }
}
