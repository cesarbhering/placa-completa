// Fonte primaria da consulta por placa (contratada em 09/nov/2026): plano fixo
// mensal com franquia diaria. A fonte antiga (cobrada por chamada) virou so
// fallback, ver server/utils/placa-lookup.ts.
//
// Usamos o endpoint getplacafipe e nao o getplaca: custa a MESMA cota (1 por
// consulta, conferido no getquotas em 09/nov) e ja traz a lista FIPE, que a
// consulta gratis usa pro valor atual, o grafico, o seguro e o ICV5. Sem a
// lista, cada consulta servida por aqui perderia o valor FIPE da tela.
//
// O adapter devolve o MESMO formato que o resto do codigo ja le da fonte antiga
// (MARCA/MODELO/anoModelo/extra.chassi/fipe.dados[]...), entao FIPE, cache,
// mascara de chassi, sinais e premium seguem iguais. Campo que esta fonte nao
// tem simplesmente nao aparece (mesmo tratamento de "ausente" de hoje).
//
// Nunca logar payload: tem chassi e numero do motor.

const URL_PLACAFIPE = 'https://api.placafipe.com.br/getplacafipe'
export const PLACAFIPE_TIMEOUT_MS = 4000

// Codigos de retorno (doc.placafipe.com.br/api/codigos.html).
const COD_SUCESSO = 1
const COD_OUTRO_COMBUSTIVEL = 22 // achou o veiculo, FIPE em outro combustivel
const COD_SEM_FIPE = new Set([312, 499]) // veiculo pode vir, tabela FIPE nao
const COD_NAO_ENCONTRADA = new Set([759, 763, 167])
const COD_COTA = 4862

export type ResultadoPlacaFipe =
  | { tipo: 'ok'; payload: any }
  | { tipo: 'nao_encontrada' }
  | { tipo: 'cota' }
  | { tipo: 'erro'; motivo: string }

// ---------------------------------------------------------------------------
// Disjuntor: quando a fonte esta fora, nao martelar. Simples e por processo.
//  - 3 falhas seguidas (erro/timeout/HTTP 5xx) -> pula a fonte por 5 min.
//  - cota esgotada -> pula ate a virada do dia (meia-noite de Brasilia).
// "Nao encontrada" nao e falha: e resposta valida da fonte.
// ---------------------------------------------------------------------------
const FALHAS_PARA_ABRIR = 3
const PAUSA_FALHA_MS = 5 * 60 * 1000

const disjuntor = { falhasSeguidas: 0, abertoAte: 0, motivo: '' as '' | 'falhas' | 'cota' }

/** Proxima meia-noite em Brasilia (UTC-3, sem horario de verao). */
export function proximaMeiaNoiteBrasilia(agora = Date.now()): number {
  const OFFSET = 3 * 60 * 60 * 1000
  const local = new Date(agora - OFFSET)
  const meiaNoiteLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1)
  return meiaNoiteLocal + OFFSET
}

export function placaFipeDisponivel(agora = Date.now()): boolean {
  return agora >= disjuntor.abertoAte
}

function registrarResultado(r: ResultadoPlacaFipe, agora = Date.now()) {
  if (r.tipo === 'cota') {
    disjuntor.falhasSeguidas = 0
    disjuntor.abertoAte = proximaMeiaNoiteBrasilia(agora)
    disjuntor.motivo = 'cota'
    console.warn('[placafipe] cota diaria esgotada; usando fallback ate a virada do dia')
    return
  }
  if (r.tipo === 'erro') {
    disjuntor.falhasSeguidas++
    if (disjuntor.falhasSeguidas >= FALHAS_PARA_ABRIR) {
      disjuntor.abertoAte = agora + PAUSA_FALHA_MS
      disjuntor.motivo = 'falhas'
      disjuntor.falhasSeguidas = 0
      console.warn(`[placafipe] ${FALHAS_PARA_ABRIR} falhas seguidas (${r.motivo}); pausando por 5 min`)
    }
    return
  }
  disjuntor.falhasSeguidas = 0
}

/** So pra teste. */
export function _resetDisjuntorPlacaFipe() {
  disjuntor.falhasSeguidas = 0
  disjuntor.abertoAte = 0
  disjuntor.motivo = ''
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

function txt(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

/** Valor inteiro (sem mascara) ou null. A fonte mascara com "*" quando o token nao tem acesso. */
function semMascara(v: unknown, minimo: number): string | null {
  const s = String(v ?? '').trim().toUpperCase()
  if (!s || s.includes('*')) return null
  const limpo = s.replace(/[^A-Z0-9]/g, '')
  return limpo.length >= minimo ? limpo : null
}

/** "41870.00" -> "R$ 41.870,00" (formato que o resto do codigo ja parseia). */
export function valorParaTexto(v: unknown): string | null {
  const n = Number(String(v ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Converte a resposta crua da fonte no formato interno de sempre. */
export function mapearPlacaFipe(resp: any, placa: string): any | null {
  const iv = resp?.informacoes_veiculo
  if (!iv || typeof iv !== 'object' || !(txt(iv.marca) || txt(iv.modelo))) return null

  const marca = txt(iv.marca)
  const modelo = txt(iv.modelo)
  const chassiCheio = semMascara(iv.chassi, 17)
  const chassiCheioValido = chassiCheio && chassiCheio.length === 17 ? chassiCheio : null
  // Chassi mascarado pela propria fonte vai pra raiz, como a fonte antiga
  // fazia; consulta.post.ts mostra esse valor como veio, sem re-mascarar.
  const chassiMascarado = !chassiCheioValido && txt(iv.chassi)?.includes('*') ? txt(iv.chassi) : null

  const fipe = Array.isArray(resp?.fipe) ? resp.fipe : []
  const dados = fipe
    .filter((f: any) => f && txt(f.codigo_fipe) && txt(f.modelo))
    .map((f: any) => ({
      codigo_fipe: String(f.codigo_fipe),
      codigo_marca: txt(f.codigo_marca),
      codigo_modelo: txt(f.codigo_modelo),
      texto_marca: txt(f.marca),
      texto_modelo: String(f.modelo),
      texto_valor: valorParaTexto(f.valor),
      ano_modelo: f.ano_modelo ?? null,
      combustivel: txt(f.combustivel),
      mes_referencia: txt(f.mes_referencia),
      // Mesmo papel do score da fonte antiga: o resto do codigo pega o maior.
      score: Number(f.similaridade) || 0,
    }))

  const extra: Record<string, any> = {
    ano_modelo: txt(iv.ano_modelo),
    ano_fabricacao: txt(iv.ano),
    combustivel: txt(iv.combustivel),
    segmento: txt(iv.segmento),
    sub_segmento: txt(iv.sub_segmento),
    cilindradas: txt(iv.cilindradas),
    potencia: txt(iv.potencia),
  }
  if (chassiCheioValido) extra.chassi = chassiCheioValido
  const motor = semMascara(iv.motor, 4)
  if (motor) extra.motor = motor

  const out: Record<string, any> = {
    MARCA: marca,
    marca,
    MODELO: modelo,
    modelo,
    marcaModelo: marca && modelo ? `${marca}/${modelo}` : (modelo || marca),
    listamodelo: Array.isArray(iv.modelo_lista) ? iv.modelo_lista : undefined,
    ano: txt(iv.ano),
    anoModelo: txt(iv.ano_modelo),
    cor: txt(iv.cor),
    municipio: txt(iv.municipio),
    uf: txt(iv.uf),
    segmento: txt(iv.segmento),
    sub_segmento: txt(iv.sub_segmento),
    placa: txt(resp?.placa) || placa,
    placa_alternativa: txt(iv.placa_alternativa),
    extra,
    fipe: { dados },
  }
  if (chassiMascarado) out.chassi = chassiMascarado
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
  return out
}

function classificar(resp: any, placa: string): ResultadoPlacaFipe {
  const codigo = Number(resp?.codigo)
  if (codigo === COD_COTA) return { tipo: 'cota' }
  if (codigo === COD_SUCESSO || codigo === COD_OUTRO_COMBUSTIVEL || COD_SEM_FIPE.has(codigo)) {
    const payload = mapearPlacaFipe(resp, placa)
    if (payload) return { tipo: 'ok', payload }
    return { tipo: 'nao_encontrada' }
  }
  if (COD_NAO_ENCONTRADA.has(codigo)) return { tipo: 'nao_encontrada' }
  return { tipo: 'erro', motivo: `codigo ${Number.isFinite(codigo) ? codigo : 'ausente'}` }
}

/**
 * Consulta a fonte primaria. Nunca lanca. Respeita o disjuntor: com ele aberto
 * devolve erro sem chamar a rede.
 */
export async function consultarPlacaFipe(
  placa: string,
  token: string,
  opts: { aoTerminar?: (http: number | null, ms: number) => void } = {},
): Promise<ResultadoPlacaFipe> {
  if (!token) return { tipo: 'erro', motivo: 'sem token' }
  if (!placaFipeDisponivel()) return { tipo: 'erro', motivo: `disjuntor (${disjuntor.motivo})` }

  const t0 = Date.now()
  let r: ResultadoPlacaFipe
  let http: number | null = 200
  try {
    const resp = await $fetch<any>(URL_PLACAFIPE, {
      method: 'POST',
      body: { placa, token },
      timeout: PLACAFIPE_TIMEOUT_MS,
      retry: 0,
    })
    r = classificar(resp, placa)
  } catch (e: any) {
    http = e?.status ?? e?.statusCode ?? e?.response?.status ?? null
    // Algumas respostas de negocio podem vir com HTTP de erro: o corpo manda.
    const corpo = e?.data
    if (corpo && typeof corpo === 'object' && corpo.codigo !== undefined) {
      r = classificar(corpo, placa)
    } else {
      const motivo = e?.name === 'AbortError' || /timeout|aborted/i.test(String(e?.message)) ? 'timeout' : `http ${http ?? 'rede'}`
      r = { tipo: 'erro', motivo }
    }
  }
  try { opts.aoTerminar?.(http, Date.now() - t0) } catch { /* log nunca derruba */ }
  registrarResultado(r)
  return r
}
