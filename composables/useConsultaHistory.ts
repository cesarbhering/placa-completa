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
  /**
   * Se a pessoa ja abriu o relatorio NESTE aparelho. Ausente = item salvo antes
   * deste campo existir: conta como aberto, senao todo historico antigo viraria
   * "relatorio esperando" de uma vez. Item novo nasce com false e vira true na
   * pagina do relatorio (/premium/<token>) ou no botao do aviso.
   */
  aberto?: boolean
}

/** Relatorio pronto que a pessoa ainda nao abriu neste aparelho. */
export function relatorioPendente(it: Pick<ConsultaLocal, 'status' | 'aberto'>): boolean {
  return it.status === 'entregue' && it.aberto === false
}

const KEY = 'pc_consultas_v1'
// Flag do Nuxt (false no SSR); fora do Nuxt, num teste, vale ter window.
const noNavegador = () => import.meta.client ?? (typeof window !== 'undefined')
const MAX = 12

export function useConsultaHistory() {
  const itens = useState<ConsultaLocal[]>('pc-consulta-history', () => [])

  function ler(): ConsultaLocal[] {
    if (!noNavegador()) return []
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
    if (!noNavegador()) return
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

  function add(e: { token: string; placa: string; veiculo?: string | null; status?: string; aberto?: boolean }) {
    const agora = new Date().toISOString()
    const antes = ler()
    const anterior = antes.find((x) => x.token === e.token)
    const arr = antes.filter((x) => x.token !== e.token)
    // Re-adicionar um pedido que ja existia nao pode "desabrir" o relatorio:
    // mantem o que estava (inclusive o campo ausente dos itens antigos).
    const aberto = anterior ? anterior.aberto : (e.aberto ?? false)
    arr.unshift({
      token: e.token,
      placa: e.placa,
      veiculo: e.veiculo ?? null,
      status: e.status ?? 'aguardando_pagamento',
      criadoEm: agora,
      atualizadoEm: agora,
      ...(aberto === undefined ? {} : { aberto }),
    })
    salvar(arr)
  }

  function marcarAberto(token: string) {
    const arr = ler()
    const i = arr.findIndex((x) => x.token === token)
    if (i === -1 || arr[i].aberto !== false) return
    arr[i] = { ...arr[i], aberto: true }
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

  return { itens, sync, add, updateStatus, marcarAberto, remove, clear }
}
