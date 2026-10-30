// Historico de passagem por leilao (servico leiloes-api, rede docker).
//
// FAIL-OPEN, igual ao vin-decoder: timeout curto e qualquer erro devolvem null,
// e o relatorio sai sem a secao. Um relatorio pago nunca pode falhar porque um
// servico auxiliar caiu.
//
// A chamada e SEMPRE server-side: a key vive no runtime config privado e nunca
// entra no bundle. Sem `leiloesApiUrl` configurada a funcao nem tenta, que e
// como a feature fica restrita ao homolog por enquanto.

import { fonteExibicaoLeilao, paginaPublicaLeilao, leiloeiroValido, sanearCasaLeilao } from '../../shared/leilao-exibicao'
import { ehNotificacao, GRAVIDADE_NOTIFICADO } from '../../shared/leilao-notificacao'
import { historicoLgpd } from '../../shared/leilao-lgpd'
import { fotoRefsDaPassagem, videosDaPassagem, MAX_MIDIAS_LOTE, type FotoRef, type VideoLote } from '../../shared/foto-lote'
import { ehRevendaFrota, sanearRevendaFrota, type RevendaFrota } from '../../shared/revenda-frota'
import {
  sanearOrigem, sanearAlertas, sanearDesfecho, sanearLotePublico, sanearContextoJudicial,
  sanearLinhaDoTempoLeilao, sanearRecorrencia,
  type OrigemLeilao, type AlertaLeilao, type DesfechoLeilao, type LotePublico, type ContextoJudicial,
  type EventoLeilaoApi, type RecorrenciaLeilao,
} from '../../shared/leilao-relatorio2'
import { comFonteCache, chaveDePlaca } from './fonte-cache'
import { registrarChamada } from './api-chamadas'

export type NivelLeilao = 'confirmado' | 'provavel' | 'possivel'

/** Termometro de gravidade que a API calcula por passagem. */
export interface GravidadeLeilao {
  nivel: string
  cor: 'verde' | 'amarelo' | 'laranja' | 'vermelho' | 'cinza' | string
  rotulo: string
  motivo: string
}

export interface PassagemLeilao {
  nivel: NivelLeilao
  score: number
  fonte: string
  fonte_tipo: 'detran' | 'privado' | string
  fonte_uf: string | null
  /**
   * Nome PUBLICO da fonte: "Detran SP" pra orgao e o nome da casa pra
   * leiloeira privada ("Copart", "Superbid"). Decisao do Cesar (06/out):
   * reverte a regra antiga de mascarar a casa como "Leiloeira particular".
   */
  fonte_exibicao: string
  gravidade: GravidadeLeilao | null
  /** O que a fonte expoe sobre o estado do veiculo (monta, sucata, km, dano). */
  detalhes: Record<string, unknown>
  data_leilao: string | null
  ref: string | null
  lote: string | null
  valor: number | null
  situacao: string | null
  leiloeiro: string | null
  /** Casa que realizou o leilao de DETRAN (leiloes-api, 29/out). So orgao; opcional. */
  casa_leilao?: { site: string; nome: string | null } | null
  comitente: string | null
  /**
   * Edital do leilao, quando a leiloes-api marca como disponivel: DETRAN ou
   * edital judicial de casa privada (decisao do Cesar, 07/out). Notificacao,
   * nunca.
   *
   * `edital_ref` e um token opaco da leiloes-api ("<id>.<hmac12>"), nao a URL.
   * A URL assinada dura 24h e e gerada a cada clique; guardar uma no snapshot
   * significaria entregar um link morto depois de um dia, e um link vivo pra
   * quem copiasse o JSON no primeiro.
   */
  edital_disponivel?: boolean
  edital_ref?: string | null
  /**
   * Pagina publica do lote na leiloeira (leiloes-api #65): so em leilao
   * judicial de casa privada cujo edital NAO pode ser entregue (dados das
   * partes). Nunca junto com edital_disponivel. https + host conhecido.
   */
  pagina_publica_url?: string | null
  veiculo_na_fonte: Record<string, any> | null
  evidencias: string[]
  conflitos: string[]
  /** URLs de foto do lote, servidas pelo nosso armazenamento. */
  fotos: string[]
  /** Fotos do lote no nosso R2, por referencia (leiloes-api #141): a pagina usa /api/premium/foto. */
  foto_refs?: FotoRef[]
  /** Videos do lote (R2 por ref, embed YouTube/Vimeo ou link da leiloeira), 27/out/2026. */
  video_refs?: VideoLote[]
  /**
   * A leiloes-api ainda esta buscando as fotos do lote (detalhes.fotos_pendente).
   * A pagina mostra "Buscando fotos do anúncio…"; o job fotos-depois grava os
   * foto_refs quando chegam (Cesar, 18/out/2026).
   */
  fotos_pendente?: boolean
  // Relatorio 2.0 (shared/leilao-relatorio2.ts): desconhecido = null/vazio.
  origem?: OrigemLeilao | null
  alertas?: AlertaLeilao[]
  desfecho?: DesfechoLeilao | null
  lote_publico?: LotePublico | null
  contexto_judicial?: ContextoJudicial | null
}

export interface HistoricoLeilao {
  /** Quando a base de leiloes foi consultada (cache de 30 d no relatorio pago; Relatorio 2.0). */
  consultadoEm?: string | null
  resumo: {
    tem_indicio: boolean
    nivel_max: NivelLeilao | null
    n_confirmado: number
    n_provavel: number
    n_possivel: number
    /**
     * Lotes que casaram por um perfil comum demais (mesmo conjunto de
     * evidencias em varios lotes diferentes). Nao sao indicio: apontam para
     * "existem varios carros assim", nao para este carro.
     */
    possiveis_ambiguos: number
    fontes_com_passagem: string[]
  }
  passagens: PassagemLeilao[]
  indice_atualizado_em: string | null
  aviso: string | null
  /** Eventos ja agrupados pela API (mesma passagem em fontes diferentes = 1). */
  linha_do_tempo?: EventoLeilaoApi[] | null
  recorrencia?: RecorrenciaLeilao | null
  /** Revenda de frota (leiloes-api #106): NAO e leilao, fica fora de passagens. */
  revendas_frota?: RevendaFrota[]
}

/** Perfil do veiculo que o relatorio ja tem em maos. */
export interface PerfilVeiculo {
  placa?: string | null
  chassi?: string | null
  renavam?: string | null
  motor?: string | null
  marca?: string | null
  modelo?: string | null
  ano?: string | number | null
  /** Ano de fabricacao e ano-modelo separados: a API compara cada um com o seu. */
  ano_fab?: string | number | null
  ano_mod?: string | number | null
  cor?: string | null
  uf?: string | null
}

const NIVEIS: NivelLeilao[] = ['confirmado', 'provavel', 'possivel']

function texto(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

/** So o que a API entende, sem campo extra e sem valor vazio. */
function corpo(perfil: PerfilVeiculo) {
  return {
    placa: texto(perfil.placa),
    chassi: texto(perfil.chassi),
    renavam: texto(perfil.renavam),
    motor: texto(perfil.motor),
    marca: texto(perfil.marca),
    modelo: texto(perfil.modelo),
    ano: texto(perfil.ano),
    ano_fab: texto(perfil.ano_fab),
    ano_mod: texto(perfil.ano_mod),
    cor: texto(perfil.cor),
    uf: texto(perfil.uf),
  }
}

/** "detran_sp" vira "Detran SP". So pra fonte oficial. */
function nomeDeOrgao(bruto: unknown): string {
  const partes = String(bruto || '').split(/[_\s]+/).filter(Boolean)
  if (!partes.length) return 'Órgão de trânsito'
  return partes
    .map((x) => (x.length === 2 ? x.toUpperCase() : x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()))
    .join(' ')
}

/**
 * Hosts de onde a pagina do cliente pode carregar foto de lote. A lista e
 * allowlist mesmo, nao "https e pronto": sem ela, bastaria a API devolver a URL
 * do site da leiloeira pra pagina do nosso cliente virar hotlink de terceiro,
 * com o banner de quem a gente decidiu nao nomear, e ainda dependendo de um
 * servidor que a gente nao controla pra pagina carregar.
 *
 * Configuravel por env (NUXT_LEILOES_FOTOS_HOSTS, separada por virgula) pra dar
 * pra trocar de bucket sem deploy de codigo.
 */
const FOTOS_HOSTS_PADRAO = 'fotos.placacompleta.com.br'

export function sanearFotos(bruto: unknown, config?: { leiloesFotosHosts?: string }): string[] {
  const permitidos = String(config?.leiloesFotosHosts || FOTOS_HOSTS_PADRAO)
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (!Array.isArray(bruto) || !permitidos.length) return []
  const saida: string[] = []
  for (const item of bruto) {
    if (typeof item !== 'string') continue
    let url: URL
    try { url = new URL(item) } catch { continue }
    if (url.protocol !== 'https:') continue
    if (!permitidos.includes(url.hostname.toLowerCase())) continue
    saida.push(url.toString())
    // Todas, ate o teto de sanidade (27/out/2026: carrossel; antes eram 4).
    if (saida.length === MAX_MIDIAS_LOTE) break
  }
  return saida
}

const CORES = ['verde', 'amarelo', 'laranja', 'vermelho', 'cinza']

function sanearGravidade(g: any): GravidadeLeilao | null {
  if (!g || typeof g !== 'object') return null
  const rotulo = texto(g.rotulo)
  if (!rotulo) return null
  return {
    nivel: texto(g.nivel) || 'desconhecido',
    // Cor fora da paleta vira cinza: melhor um termometro neutro que um estilo
    // quebrado, e a cor aqui e o sinal mais forte da tela.
    cor: CORES.includes(String(g.cor)) ? String(g.cor) : 'cinza',
    rotulo,
    motivo: texto(g.motivo) || '',
  }
}

/** Confia so no formato, nunca no conteudo: resposta torta vira null. */
export function sanearHistorico(res: any, config?: { leiloesFotosHosts?: string }): HistoricoLeilao | null {
  if (!res || typeof res !== 'object' || !res.resumo) return null
  const todas = Array.isArray(res.passagens) ? res.passagens : []
  // Revenda de frota sai das passagens ANTES de tudo: nada de leilao (contagem,
  // nivel, sinal da consulta gratis, linha do tempo de leilao) pode ve-la.
  const revendas = todas.filter(ehRevendaFrota).map((p: any) => sanearRevendaFrota(p)).filter(Boolean) as RevendaFrota[]
  const brutas = todas.filter((p: any) => !ehRevendaFrota(p))
  const passagens: PassagemLeilao[] = brutas
    .filter((p: any) => p && NIVEIS.includes(p.nivel))
    .map((p: any) => ({
      nivel: p.nivel,
      score: Number(p.score) || 0,
      fonte: String(p.fonte || ''),
      fonte_tipo: String(p.fonte_tipo || ''),
      fonte_uf: texto(p.fonte_uf),
      // Nome publico da fonte. Decisao do Cesar (06/out): casa privada mostra
      // o NOME da casa (shared/leilao-exibicao.ts), nao mais "Leiloeira
      // particular", mesmo quando a API ainda manda o generico.
      fonte_exibicao: p.fonte_tipo === 'detran'
        ? (texto(p.fonte_exibicao) || nomeDeOrgao(p.fonte))
        : fonteExibicaoLeilao(p),
      // Edital de NOTIFICACAO nao e leilao realizado. A API anterior ao nivel
      // 'notificado' pintava essas linhas de "Leilao de patio" amarelo; aqui a
      // gravidade e fixada no cinza, qualquer que seja a versao da API.
      gravidade: ehNotificacao(p) ? { ...GRAVIDADE_NOTIFICADO } : sanearGravidade(p.gravidade),
      detalhes: p.detalhes && typeof p.detalhes === 'object' && !Array.isArray(p.detalhes) ? p.detalhes : {},
      data_leilao: texto(p.data_leilao),
      ref: texto(p.ref),
      lote: texto(p.lote),
      valor: typeof p.valor === 'number' ? p.valor : null,
      situacao: texto(p.situacao),
      // Leiloeiro (a PESSOA) de casa privada nunca sai daqui, nem no JSON: o
      // relatorio e publico por token. So o nome da CASA aparece (decisao do
      // Cesar, 06/out). A API ja zera, isto e a nossa garantia.
      // "Oficial designado" (placeholder antigo da API) nao e nome: null.
      leiloeiro: p.fonte_tipo === 'detran' ? leiloeiroValido(p.leiloeiro) : null,
      // Casa que realizou o leilao do orgao (rjleiloes.com.br etc.), so DETRAN.
      casa_leilao: p.fonte_tipo === 'detran' ? sanearCasaLeilao(p.casa_leilao) : null,
      comitente: texto(p.comitente),
      // Edital de qualquer fonte que a leiloes-api marcar como disponivel
      // (decisao do Cesar, 07/out): DETRAN ou edital JUDICIAL de casa privada
      // que passou no portao de LGPD de la. A regra de quais editais podem ser
      // baixados fica no backend; aqui so cai a notificacao.
      // Edital de NOTIFICACAO nunca e baixavel (decisao do Cesar, 30/set): o
      // documento traz a relacao de proprietarios. Todos os DADOS dele vao pra
      // tela; o arquivo, nao.
      edital_disponivel: !ehNotificacao(p) && !!p.edital_disponivel,
      edital_ref: !ehNotificacao(p) ? texto(p.edital_ref) : null,
      // So quando NAO ha edital pra baixar; notificacao, nunca; e so https de
      // leiloeira conhecida (shared/leilao-exibicao.ts).
      pagina_publica_url: !ehNotificacao(p) && !p.edital_disponivel ? paginaPublicaLeilao(p.pagina_publica_url) : null,
      veiculo_na_fonte: p.veiculo_na_fonte && typeof p.veiculo_na_fonte === 'object' ? p.veiculo_na_fonte : null,
      evidencias: Array.isArray(p.evidencias) ? p.evidencias.map(String) : [],
      fotos: sanearFotos(p.fotos, config),
      foto_refs: fotoRefsDaPassagem(p),
      video_refs: videosDaPassagem(p),
      fotos_pendente: p.detalhes?.fotos_pendente === true && fotoRefsDaPassagem(p).length === 0,
      conflitos: Array.isArray(p.conflitos) ? p.conflitos.map(String) : [],
      origem: sanearOrigem(p.origem),
      alertas: sanearAlertas(p.alertas),
      desfecho: ehNotificacao(p) ? null : sanearDesfecho(p.desfecho),
      lote_publico: ehNotificacao(p) ? null : sanearLotePublico(p.lote_publico),
      contexto_judicial: ehNotificacao(p) ? null : sanearContextoJudicial(p.contexto_judicial),
    }))

  // LGPD (14/out): sem numero de processo e sem comitente pessoa fisica, nem
  // no snapshot (shared/leilao-lgpd.ts).
  // Revenda no resumo: a API ate o PR #112 (leiloes-api) somava a frota em
  // n_confirmado/n_provavel/n_possivel, tem_indicio, nivel_max e
  // fontes_com_passagem, e tratava o evento como leilao na linha_do_tempo e na
  // recorrencia. Sem o campo novo resumo.n_revenda_frota, a resposta e da API
  // antiga: desconta aqui, e com revenda presente a linha_do_tempo/recorrencia
  // da API sao ignoradas (o site volta ao modo por passagem, ja sem a frota).
  const apiAntiga = revendas.length > 0 && res.resumo.n_revenda_frota === undefined
  const menos = (nivel: string) => (apiAntiga ? todas.filter((p: any) => ehRevendaFrota(p) && p.nivel === nivel).length : 0)
  const n_confirmado = Math.max(0, (Number(res.resumo.n_confirmado) || 0) - menos('confirmado'))
  const n_provavel = Math.max(0, (Number(res.resumo.n_provavel) || 0) - menos('provavel'))
  const n_possivel = Math.max(0, (Number(res.resumo.n_possivel) || 0) - menos('possivel'))
  const fontesFrota = new Set(todas.filter(ehRevendaFrota).map((p: any) => String(p.fonte || '')))
  const fontes: string[] = Array.isArray(res.resumo.fontes_com_passagem) ? res.resumo.fontes_com_passagem.map(String) : []
  const nivelMax = NIVEIS.includes(res.resumo.nivel_max) ? res.resumo.nivel_max : null
  return historicoLgpd({
    resumo: {
      tem_indicio: apiAntiga ? passagens.some((p) => p.nivel !== 'possivel') || (!!res.resumo.tem_indicio && n_confirmado + n_provavel + n_possivel > 0) : !!res.resumo.tem_indicio,
      nivel_max: apiAntiga ? (NIVEIS.find((n) => passagens.some((p) => p.nivel === n)) ?? null) : nivelMax,
      n_confirmado,
      n_provavel,
      n_possivel,
      possiveis_ambiguos: Number(res.resumo.possiveis_ambiguos) || 0,
      fontes_com_passagem: apiAntiga ? fontes.filter((f) => !fontesFrota.has(f)) : fontes,
    },
    passagens,
    indice_atualizado_em: texto(res.indice_atualizado_em),
    aviso: texto(res.aviso),
    linha_do_tempo: apiAntiga ? null : sanearLinhaDoTempoLeilao(res.linha_do_tempo),
    revendas_frota: revendas,
    recorrencia: apiAntiga ? null : sanearRecorrencia(res.recorrencia),
  })
}

export async function consultarHistoricoLeilao(
  perfil: PerfilVeiculo,
  opts?: {
    /**
     * Teto de espera em ms. O relatorio pago espera ate 15s porque a secao
     * vale a espera; a consulta GRATIS nao pode atrasar por causa disto, entao
     * ela passa um teto curto e desiste calada.
     */
    timeoutMs?: number
    /**
     * Relatorio 2.0 (Cesar 14/out): cache de 30 d por placa+chassi no fonte_cache. So o relatorio PAGO liga;
     * o sinal da consulta gratis continua sempre ao vivo (um leilao novo aparece na hora no gratis).
     */
    cache?: boolean
  },
): Promise<HistoricoLeilao | null> {
  const config = useRuntimeConfig()
  const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
  const key = String(config.leiloesApiKey || '')
  if (!base || !key) return null

  const body = corpo(perfil)
  // A API exige ao menos um identificador; sem nenhum, nem vale a chamada.
  if (!body.placa && !body.chassi && !body.renavam && !body.motor) return null

  const sb = (() => { try { return useSupabaseServer() } catch { return null } })()
  const chamar = async (): Promise<HistoricoLeilao> => {
    const t0 = Date.now()
    try {
      const r = await chamarApi()
      registrarChamada(sb, { fonte: 'leiloes_api', caminho: '/v1/historico', code: 200, ms: Date.now() - t0 })
      return r
    } catch (e: any) {
      registrarChamada(sb, { fonte: 'leiloes_api', caminho: '/v1/historico', code: e?.statusCode ?? e?.response?.status ?? null, ms: Date.now() - t0 })
      throw e
    }
  }
  const chamarApi = async () => {
    const res = await $fetch<any>(`${base}/v1/historico`, {
      method: 'POST',
      // Identifica a origem no log da API. Sem isto, consulta de PRODUCAO
      // apareceria como homolog no api_consultas e a analise de uso viraria
      // ficcao.
      headers: {
        'X-API-Key': key,
        'X-Origem': config.public.gated ? 'homolog-premium' : 'prod-premium',
      },
      body,
      // 15s: a API cruza o perfil com ~1,4M linhas e a latencia varia muito
      // (medi de 0,4s a 2,4s pra mesma placa, e o teto de 3s ja cortou uma
      // resposta boa em producao de teste). Como o fluxo aqui e a montagem do
      // relatorio ja pago, esperar e melhor que entregar sem a secao. Segue
      // ajustavel por env.
      timeout: opts?.timeoutMs || Number(config.leiloesApiTimeoutMs) || 15000,
    })
    return sanearHistorico(res, { leiloesFotosHosts: String(config.leiloesFotosHosts || '') })
  }

  try {
    const chave = [chaveDePlaca(body.placa || ''), String(body.chassi || '').toUpperCase()].join('|')
    if (opts?.cache && sb && chave !== '|') {
      const r = await comFonteCache(sb, 'leilao', chave, async () => {
        const h = await chamar()
        return { status: h.resumo.tem_indicio ? 'ok' : 'sem_dado', payload: h }
      })
      return { ...r.payload, consultadoEm: r.consultadoEm }
    }
    return { ...(await chamar()), consultadoEm: new Date().toISOString() }
  } catch (e: any) {
    // Fora do ar, timeout, key errada, 5xx: tudo cai aqui. So um log.
    console.warn('[leiloes-api] historico falhou (fail-open):', e?.message)
    return null
  }
}
