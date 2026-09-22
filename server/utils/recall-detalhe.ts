// ---------------------------------------------------------------------------
// Detalhe do recall pendente (22/set/2026).
//
// O registro do veiculo diz apenas que existe recall pendente. Quem comprou o
// relatorio fica sem saber de QUE campanha se trata, e a frase "recall
// pendente" sozinha nao ajuda a decidir compra nem a marcar a concessionaria.
// O detalhe existe num portal publico, so que atras de um formulario, entao
// quem vai ate la e um agente de navegador na nuvem.
//
// Tres freios, porque cada consulta custa dinheiro de verdade:
//   cache de 30 dias por placa, no maximo 2 tentativas por placa na janela,
//   e teto de gasto por dia.
// Tudo fail-open: sem chave, sem resposta, fora do ar ou JSON estranho, o
// relatorio sai como sempre saiu, sem o bloco. Nenhum caminho aqui pode
// derrubar uma entrega ja paga.
//
// A chave e o texto da tarefa nunca vao pra log: log de erro guarda so a
// mensagem e o id da execucao.
// ---------------------------------------------------------------------------

const API = 'https://api.browser-use.com/api/v4'

/** 30 dias: campanha de recall nao muda de semana em semana. */
const CACHE_DIAS = 30
const MAX_TENTATIVAS_POR_PLACA = 2
const TETO_DIARIO_USD = 3
const TETO_POR_RUN_USD = 1
const INTERVALO_POLL_MS = 8000
export const TIMEOUT_PADRAO_MS = 4 * 60 * 1000

export type StatusRecall = 'ok' | 'sem_recall' | 'captcha' | 'erro'

export interface CampanhaRecall {
  montadora: string
  campanha: string
  descricao: string
  componente: string
  data_inicio: string
  situacao: string
}

export interface RecallDetalhe {
  status: StatusRecall
  placa: string | null
  campanhas: CampanhaRecall[]
  texto_pagina: string | null
  url_final: string | null
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v)
}

/**
 * O agente responde texto livre. Na pratica ele devolve ou o JSON puro ou o
 * JSON dentro de uma cerca de codigo, e as vezes com uma frase antes. Aqui
 * tentamos os tres casos, nessa ordem, e desistimos em silencio se nada for
 * JSON valido: resposta que nao da pra ler vale o mesmo que resposta nenhuma.
 */
export function parseResultadoRecall(bruto: unknown): RecallDetalhe | null {
  const s = texto(bruto)
  if (!s) return null

  const candidatos: string[] = []
  const cerca = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (cerca?.[1]) candidatos.push(cerca[1])
  candidatos.push(s)
  const solto = s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)
  if (solto.startsWith('{')) candidatos.push(solto)

  for (const c of candidatos) {
    let obj: any
    try { obj = JSON.parse(c.trim()) } catch { continue }
    if (!obj || typeof obj !== 'object') continue
    const status = texto(obj.status).toLowerCase()
    if (!['ok', 'sem_recall', 'captcha', 'erro'].includes(status)) continue
    const lista = Array.isArray(obj.campanhas) ? obj.campanhas : []
    return {
      status: status as StatusRecall,
      placa: texto(obj.placa) || null,
      // Campanha sem nenhum campo preenchido e ruido: entraria no relatorio
      // como uma linha em branco com ar de erro.
      campanhas: lista
        .map((c: any) => ({
          montadora: texto(c?.montadora),
          campanha: texto(c?.campanha),
          descricao: texto(c?.descricao),
          componente: texto(c?.componente),
          data_inicio: texto(c?.data_inicio),
          situacao: texto(c?.situacao),
        }))
        .filter((c: CampanhaRecall) => Object.values(c).some((v) => v !== '')),
      texto_pagina: texto(obj.texto_pagina).slice(0, 600) || null,
      url_final: texto(obj.url_final) || null,
    }
  }
  return null
}

/**
 * O indicador vive dentro de `restricoes` na resposta crua, que as vezes chega
 * achatada num array de um elemento (mesmo caso ja tratado no snapshot). Sem
 * esta checagem, toda entrega iria ao portal, inclusive as 9 em cada 10 que
 * nao tem recall nenhum.
 */
export function temRecallPendente(response: any): boolean {
  const bruto = Array.isArray(response) ? response[0] : response
  return bruto?.restricoes?.indicadorRecall === true
}

/** Status que vale guardar como resposta boa: o resto pode ser tentado de novo. */
export function respostaUtil(d: RecallDetalhe | null): boolean {
  return !!d && (d.status === 'ok' || d.status === 'sem_recall')
}

function montarTarefa(placa: string): string {
  return [
    // URL direta da consulta publica, com a placa ja na rota: navegar pelo
    // menu gastava passos do agente (e dinheiro) para chegar no mesmo lugar.
    `Você está no Brasil. Abra https://portalservicos.senatran.serpro.gov.br/#/veiculos/recall/detalhes/placa/${placa} e espere o resultado carregar. É uma consulta pública, não exige login.`,
    'Se a página pedir a placa num formulário, preencha com ' + placa + ' e envie.',
    'Se aparecer um desafio de captcha com imagens, tente resolvê-lo uma vez; se não conseguir, pare e responda status "captcha".',
    'Responda APENAS um JSON, sem texto em volta, no formato:',
    `{"status": "ok" | "sem_recall" | "captcha" | "erro", "placa": "${placa}", "campanhas": [{"montadora": "", "campanha": "", "descricao": "", "componente": "", "data_inicio": "", "situacao": ""}], "texto_pagina": "resumo literal do que a página mostrou (até 600 caracteres)", "url_final": ""}`,
    'Não digite nada além da placa. Não crie conta. Não navegue para outros sites.',
  ].join(' ')
}

function chave(): string | null {
  const k = process.env.NUXT_BROWSER_USE_API_KEY || ''
  return k ? k : null
}

async function chamar(caminho: string, init: RequestInit, k: string): Promise<any> {
  const r = await fetch(`${API}${caminho}`, {
    ...init,
    headers: { 'X-Browser-Use-API-Key': k, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (!r.ok) throw new Error(`browser-use ${caminho} respondeu ${r.status}`)
  return r.json()
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

const inicioDoDiaUTC = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString()
const desdeCacheISO = () => new Date(Date.now() - CACHE_DIAS * 86400000).toISOString()

/** Linha de cache valida, ou null. Erro de banco nao bloqueia a busca. */
async function doCache(supabase: any, placa: string): Promise<RecallDetalhe | null> {
  try {
    const { data } = await supabase
      .from('recall_consultas')
      .select('status,campanhas,texto_pagina,placa')
      .eq('placa', placa)
      .in('status', ['ok', 'sem_recall'])
      .gte('criado_em', desdeCacheISO())
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return {
      status: data.status,
      placa: data.placa ?? placa,
      campanhas: Array.isArray(data.campanhas) ? data.campanhas : [],
      texto_pagina: data.texto_pagina ?? null,
      url_final: null,
    }
  } catch { return null }
}

/**
 * Os dois freios de gasto. Falha de leitura NAO libera a consulta: se nao da
 * pra saber quanto ja foi gasto hoje, o certo e nao gastar mais.
 */
async function podeGastar(supabase: any, placa: string): Promise<boolean> {
  try {
    const { data: doDia } = await supabase
      .from('recall_consultas')
      .select('custo_usd')
      .gte('criado_em', inicioDoDiaUTC())
    const gastoHoje = (doDia || []).reduce((s: number, r: any) => s + (Number(r.custo_usd) || 0), 0)
    if (gastoHoje >= TETO_DIARIO_USD) {
      console.warn(`[recall] teto diario atingido (US$ ${gastoHoje.toFixed(2)}), pulando`)
      return false
    }
    const { data: daPlaca } = await supabase
      .from('recall_consultas')
      .select('id')
      .eq('placa', placa)
      .gte('criado_em', desdeCacheISO())
    if ((daPlaca || []).length >= MAX_TENTATIVAS_POR_PLACA) return false
    return true
  } catch {
    return false
  }
}

async function registrar(supabase: any, linha: Record<string, any>): Promise<void> {
  try {
    await supabase.from('recall_consultas').insert(linha)
  } catch (e: any) {
    console.warn('[recall] insert falhou:', e?.message || e)
  }
}

/**
 * Busca o detalhe do recall da placa. Devolve null sempre que nao houver
 * resposta util: quem chama trata null como "relatorio sem o bloco".
 */
export async function buscarRecallDetalhe(
  supabase: any,
  opts: { placa: string; consultaId?: string | null; timeoutMs?: number },
): Promise<RecallDetalhe | null> {
  const placa = String(opts.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!placa) return null

  const cache = await doCache(supabase, placa)
  if (cache) return cache

  const k = chave()
  if (!k) return null   // env nao configurada: o relatorio segue sem o bloco
  if (!(await podeGastar(supabase, placa))) return null

  const limite = opts.timeoutMs ?? TIMEOUT_PADRAO_MS
  const t0 = Date.now()
  let runId: string | null = null

  try {
    const run = await chamar('/runs', {
      method: 'POST',
      body: JSON.stringify({
        task: montarTarefa(placa),
        model: 'claude-sonnet-5',
        browserSettings: { proxyCountryCode: 'br' },
        maxCostUsd: TETO_POR_RUN_USD,
      }),
    }, k)
    runId = texto(run?.id) || null
    if (!runId) return null

    while (Date.now() - t0 < limite) {
      await esperar(INTERVALO_POLL_MS)
      const s = await chamar(`/runs/${runId}`, { method: 'GET' }, k)
      const status = texto(s?.status)
      if (status === 'completed') {
        const detalhe = parseResultadoRecall(s?.result)
        await registrar(supabase, {
          placa,
          consulta_id: opts.consultaId ?? null,
          status: detalhe?.status ?? 'erro',
          campanhas: detalhe?.campanhas ?? [],
          texto_pagina: detalhe?.texto_pagina ?? null,
          run_id: runId,
          custo_usd: Number(s?.totalCostUsd) || 0,
        })
        return respostaUtil(detalhe) ? detalhe : null
      }
      if (status === 'failed' || status === 'cancelled') {
        await registrar(supabase, {
          placa, consulta_id: opts.consultaId ?? null, status: 'erro',
          campanhas: [], texto_pagina: null, run_id: runId,
          custo_usd: Number(s?.totalCostUsd) || 0,
        })
        return null
      }
    }

    // Estourou o tempo: cancela pra nao seguir gastando depois que ninguem
    // mais espera a resposta, e conta a tentativa.
    await chamar(`/runs/${runId}/cancel`, { method: 'POST', body: '{}' }, k).catch(() => null)
    await registrar(supabase, {
      placa, consulta_id: opts.consultaId ?? null, status: 'erro',
      campanhas: [], texto_pagina: 'tempo esgotado', run_id: runId, custo_usd: 0,
    })
    return null
  } catch (e: any) {
    // Mensagem e id da execucao apenas: nem a chave nem o texto da tarefa.
    console.warn(`[recall] falhou (run=${runId || 'nao criado'}):`, e?.message || 'erro')
    return null
  }
}
