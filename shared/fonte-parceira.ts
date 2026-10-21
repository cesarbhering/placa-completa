// Base parceira de leiloes e sinistros (Cesar, 20/out/2026).
//
// Segunda fonte de leilao e indicio de sinistro no Relatorio Completo, chamada
// so quando a nossa base de leiloes nao acha nada. Regra do Cesar: o NOME do
// fornecedor nunca aparece em nada publico (pagina, e-mail, impressao, JSON
// do relatorio, atendimento). O rotulo publico e unico e mora AQUI. O nome so
// existe no codigo interno do servidor (server/utils/parceiro-leilao.ts), em
// premium_custos, fonte_cache e logs.
//
// Este arquivo e puro (sem rede): parser tolerante da resposta e a conversao
// em passagens do historico de leilao.

/** Chave da fonte nas passagens e no snapshot (vai no JSON do cliente: neutra). */
export const FONTE_PARCEIRA = 'parceiro'
/** fonte_exibicao da passagem (o mesmo lugar que mostra "Copart", "Detran SP"). */
export const ROTULO_PARCEIRA = 'Base parceira'
/** Descricao por extenso, para frases. */
export const DESCRICAO_PARCEIRA = 'base parceira de leilões e sinistros'

export interface SinistroParceiro {
  indicio: boolean
  mensagem: string | null
}

/** Estado da consulta a base parceira guardado no snapshot (historicoLeilao.parceiro). */
export interface EstadoParceiro {
  /** ok: consultou; falhou: erro na geracao (o job tenta uma vez); teto: teto diario atingido. */
  status: 'ok' | 'falhou' | 'teto'
  id_consulta?: string | null
  consultado_em?: string | null
  /** O job de complemento ja tentou de novo (uma vez por pedido). */
  retentado?: boolean
}

export interface LeilaoParceiro {
  marca: string | null
  modelo: string | null
  anoModelo: string | null
  anoFabricacao: string | null
  chassi: string | null
  cor: string | null
  combustivel: string | null
  condicao: string | null
  situacaoChassi: string | null
  patio: string | null
  leiloeiro: string | null
  comitente: string | null
  lote: string | null
  /** 'AAAA-MM-DD' */
  dataLeilao: string | null
}

export interface RespostaParceiro {
  idConsulta: string | null
  dataConsulta: string | null
  tempoMs: number | null
  temRegistro: boolean
  leiloes: LeilaoParceiro[]
  sinistro: SinistroParceiro
}

/** "N/C", "NC", "NAO DIVULGADO", "0", vazio: nao informado (null). So na exibicao; o bruto fica inteiro. */
export function naoInformado(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  if (!s) return null
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  if (/^(N\/?C|N\.C\.?|NAO DIVULGADO|NAO INFORMADO|SEM INFORMACAO|NULL|-+|0)$/.test(n)) return null
  return s
}

function dataIso(v: unknown): string | null {
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const umDe = (o: any, ks: string[]) => ks.map((k) => o?.[k]).find((v) => v !== undefined)

/**
 * Resposta da base parceira -> formato interno. Tolera o formato REAL
 * ({consulta, resultados}) e o da documentacao ({resposta, retorno}).
 * null quando nao da pra confiar (sem bloco de leilao nem de sinistro).
 */
export function parsearRespostaParceiro(body: any): RespostaParceiro | null {
  if (!body || typeof body !== 'object') return null
  const cab = body.consulta || body.resposta || {}
  const ret = body.resultados || body.retorno?.resultados || body.retorno || {}
  const leilao = ret?.leilao
  const sinistro = ret?.sinistro
  if ((!leilao || typeof leilao !== 'object') && (!sinistro || typeof sinistro !== 'object')) return null
  const lista: any[] = Array.isArray(leilao?.leiloes) ? leilao.leiloes : []
  const leiloes: LeilaoParceiro[] = lista.filter((x) => x && typeof x === 'object').map((x) => ({
    marca: naoInformado(x.marca),
    modelo: naoInformado(x.modelo),
    anoModelo: naoInformado(umDe(x, ['anoModelo', 'ano_modelo'])),
    anoFabricacao: naoInformado(umDe(x, ['anoFabricacao', 'ano_fabricacao'])),
    chassi: naoInformado(x.chassi),
    cor: naoInformado(x.cor),
    combustivel: naoInformado(x.combustivel),
    condicao: naoInformado(umDe(x, ['condicaoVeiculo', 'condicao'])),
    situacaoChassi: naoInformado(x.situacaoChassi),
    patio: naoInformado(x.patio),
    leiloeiro: naoInformado(x.leiloeiro),
    comitente: naoInformado(x.comitente),
    lote: naoInformado(x.lote),
    dataLeilao: dataIso(umDe(x, ['dataLeilao', 'data_leilao', 'data'])),
  }))
  const ind = umDe(sinistro, ['indicioDeSinistro', 'indicio_de_sinistro', 'indicio'])
  const indicio = ind === true || Number(ind) === 1 || /^(s|sim|true)$/i.test(String(ind ?? ''))
  const tempo = Number(umDe(cab, ['tempoTotalMs', 'tempoMs', 'tempo']))
  return {
    idConsulta: naoInformado(umDe(cab, ['idConsulta', 'id', 'id_consulta'])),
    dataConsulta: naoInformado(umDe(cab, ['dataConsulta', 'data'])),
    tempoMs: Number.isFinite(tempo) ? tempo : null,
    temRegistro: leilao?.temRegistro === true || leiloes.length > 0,
    leiloes,
    sinistro: { indicio, mensagem: naoInformado(umDe(sinistro, ['mensagemSinistro', 'mensagem'])) },
  }
}

const so = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Cada leilao da base parceira vira uma passagem do historico. Nivel
 * 'confirmado': a base respondeu pela placa ou chassi exatos. Se o chassi da
 * resposta for completo e diferente do nosso, cai para 'possivel' com o
 * conflito anotado (nao afirmamos o que nao bate).
 * Leiloeiro (pessoa) nao vai: regra de 06/out para fonte que nao e orgao.
 */
export function passagensDoParceiro(r: RespostaParceiro, ctx: { chassi?: string | null; tipo: 'placa' | 'chassi' }) {
  const nosso = so(ctx.chassi)
  return r.leiloes.map((l) => {
    const deles = so(l.chassi)
    const conflito = nosso.length === 17 && deles.length === 17 && nosso !== deles
    const chassiIgual = nosso.length === 17 && deles === nosso
    const detalhes: Record<string, string> = {}
    if (l.condicao) detalhes.condicao = l.condicao
    if (l.combustivel) detalhes.combustivel = l.combustivel
    if (l.patio) detalhes.patio = l.patio
    const veiculo: Record<string, string> = {}
    for (const [k, v] of [['marca', l.marca], ['modelo', l.modelo], ['ano_fabricacao', l.anoFabricacao], ['ano_modelo', l.anoModelo], ['cor', l.cor]] as const) if (v) veiculo[k] = v
    return {
      nivel: (conflito ? 'possivel' : 'confirmado') as 'confirmado' | 'possivel',
      score: conflito ? 40 : 100,
      fonte: FONTE_PARCEIRA,
      fonte_tipo: FONTE_PARCEIRA,
      fonte_uf: null,
      fonte_exibicao: ROTULO_PARCEIRA,
      gravidade: null,
      detalhes,
      data_leilao: l.dataLeilao,
      ref: null,
      lote: l.lote,
      valor: null,
      situacao: null,
      leiloeiro: null,
      comitente: l.comitente,
      veiculo_na_fonte: Object.keys(veiculo).length ? veiculo : null,
      evidencias: [ctx.tipo === 'chassi' || chassiIgual ? 'chassi igual' : 'placa igual'],
      conflitos: conflito ? ['chassi diferente do deste veículo'] : [],
      fotos: [] as string[],
      foto_refs: [],
      fotos_pendente: false,
      edital_disponivel: false,
      edital_ref: null,
      pagina_publica_url: null,
      origem: null,
      alertas: [],
      desfecho: null,
      lote_publico: null,
      contexto_judicial: null,
    }
  })
}

/** O historico da nossa base veio vazio (nada de passagem nem indicio)? So ai a base parceira e consultada. */
export function nossaBaseVazia(h: any): boolean {
  if (!h || typeof h !== 'object' || !h.resumo) return false
  const passagens = Array.isArray(h.passagens) ? h.passagens : []
  return passagens.length === 0 && !h.resumo.tem_indicio
}

/** Junta a resposta da base parceira ao historico (que estava vazio). Recalcula o resumo. */
export function historicoComParceiro(base: any, r: RespostaParceiro, ctx: { chassi?: string | null; tipo: 'placa' | 'chassi'; consultadoEm: string }) {
  const novas = passagensDoParceiro(r, ctx)
  const passagens = [...(Array.isArray(base?.passagens) ? base.passagens : []), ...novas]
  const conta = (n: string) => passagens.filter((p: any) => p.nivel === n).length
  const n_confirmado = conta('confirmado'), n_provavel = conta('provavel'), n_possivel = conta('possivel')
  const fontes = new Set<string>(Array.isArray(base?.resumo?.fontes_com_passagem) ? base.resumo.fontes_com_passagem : [])
  if (novas.length) fontes.add(FONTE_PARCEIRA)
  return {
    ...(base || {}),
    resumo: {
      ...(base?.resumo || {}),
      tem_indicio: n_confirmado + n_provavel > 0,
      nivel_max: n_confirmado ? 'confirmado' : n_provavel ? 'provavel' : n_possivel ? 'possivel' : null,
      n_confirmado,
      n_provavel,
      n_possivel,
      possiveis_ambiguos: Number(base?.resumo?.possiveis_ambiguos) || 0,
      fontes_com_passagem: [...fontes],
    },
    passagens,
    // A linha do tempo da API e da nossa base (vazia): com passagem nova, a
    // pagina monta a linha a partir das passagens.
    ...(novas.length ? { linha_do_tempo: null } : {}),
    sinistro_parceiro: { indicio: r.sinistro.indicio, mensagem: r.sinistro.mensagem } as SinistroParceiro,
    parceiro: { status: 'ok', id_consulta: r.idConsulta, consultado_em: ctx.consultadoEm } as EstadoParceiro,
  }
}

import { BASE_LEILAO_TEXTO } from './base-leilao'

// ---------------------------------------------------------------- copy (publica)
// Nunca afirmar: so "consta". Sem travessao, sem citar orgao federal.

export const PASSAGEM_PARCEIRA = 'Registro em base parceira de leilões e sinistros'
export const DICA_SINISTRO = 'Consulta a uma base parceira de leilões e sinistros, feita quando a nossa base de leilões não encontra nada. Indício de sinistro quer dizer que o veículo aparece em registro ligado a sinistro; não diz a gravidade nem se houve reparo.'

/**
 * Rotulo do indicador de leilao na grade (e no parecer). Com qualquer passagem
 * da base parceira, a fonte nao e so publica: "bases consultadas". So com as
 * nossas fontes, fica o texto de sempre.
 */
export function rotuloIndicadorLeilao(passagens: unknown): string {
  const lista = Array.isArray(passagens) ? passagens : []
  const temParceira = lista.some((p: any) => p?.fonte_tipo === FONTE_PARCEIRA || p?.fonte === FONTE_PARCEIRA)
  return temParceira ? 'Histórico de leilão (bases consultadas)' : 'Histórico de leilão (fontes públicas)'
}

export interface LinhaBase { tag: 'Base própria' | 'Base parceira'; texto: string; tom: 'ok' | 'cinza' | 'alerta' }

/**
 * Secao de leilao sem registro (Cesar, 21/out/2026): uma linha com tag por
 * base consultada, no lugar da frase unica.
 *  - nossa base: sempre (so aparece quando ela nao achou nada);
 *  - base parceira: consultada e nada -> verde; consultada e so sinistro ->
 *    "consta indicio de sinistro"; falhou ou teto -> cinza (o job completa);
 *    nao consultada (desligada) -> sem a linha.
 */
export function linhasBasesSemRegistro(h: any): LinhaBase[] {
  const linhas: LinhaBase[] = [{ tag: 'Base própria', texto: `Nada encontrado na nossa base, com ${BASE_LEILAO_TEXTO}.`, tom: 'ok' }]
  const st = h?.parceiro?.status
  if (st === 'ok') {
    linhas.push(h?.sinistro_parceiro?.indicio === true
      ? { tag: 'Base parceira', texto: 'Nenhum registro de leilão. Consta indício de sinistro.', tom: 'alerta' }
      : { tag: 'Base parceira', texto: 'Nada encontrado na base do nosso parceiro premium.', tom: 'ok' })
  } else if (st === 'falhou' || st === 'teto') {
    linhas.push({ tag: 'Base parceira', texto: 'Não foi possível consultar agora.', tom: 'cinza' })
  }
  return linhas
}
