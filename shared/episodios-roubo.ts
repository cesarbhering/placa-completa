// ---------------------------------------------------------------------------
// Episodios de roubo e furto (22/set/2026).
//
// A secao mostrava um cartao vermelho por REGISTRO, entao um carro roubado e
// devolvido em seis dias aparecia como tres alarmes seguidos e o leitor
// entendia tres problemas. Os registros contam UMA historia: roubo, depois
// recuperacao, depois devolucao. Aqui eles viram episodios, e a tela desenha
// um cartao por episodio com o desfecho no cabecalho.
//
// Modulo separado da pagina de proposito: agrupamento e regra, e regra se
// testa sem montar relatorio.
// ---------------------------------------------------------------------------

export type EtapaEpisodio = 'ROUBO' | 'RECUPERACAO' | 'DEVOLUCAO'

export interface RegistroOcorrencia {
  dataOcorrencia?: string | null
  categoriaOcorrencia?: string | null
  tipoOcorrenciaDeclaracao?: string | null
  nomeMarcaModeloNoRegistroOcorrencia?: string | null
  nomeCorNoRegistroOcorrencia?: string | null
  ufJurisdicaoNoRegistroOcorrencia?: string | null
}

export interface RegistroEtapa {
  etapa: EtapaEpisodio
  /** ISO cru, do jeito que veio: quem formata e a tela. */
  data: string
  marcaModelo: string | null
  cor: string | null
  uf: string | null
}

export interface EpisodioRoubo {
  /** 'ROUBO' ou 'FURTO' quando o episodio comeca na declaracao; null quando
   *  ele comeca numa recuperacao ou devolucao solta. */
  tipoInicial: 'ROUBO' | 'FURTO' | null
  /** Etapa que abriu o episodio: serve pro rotulo de quem nao tem roubo. */
  etapaInicial: EtapaEpisodio
  registros: RegistroEtapa[]
  encerrado: boolean
  /** Dias entre a primeira e a ultima etapa, null se nao der pra contar. */
  duracaoDias: number | null
}

function texto(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
}

/**
 * Em que etapa o registro entra. A categoria manda; quando ela e a declaracao
 * generica, quem diz e o tipo. Registro que nao se encaixa em nada fica de
 * fora: inventar etapa seria pior do que omitir uma linha que ninguem sabe ler.
 */
export function etapaDoRegistro(o: RegistroOcorrencia): EtapaEpisodio | null {
  const cat = texto(o?.categoriaOcorrencia)
  const tipo = texto(o?.tipoOcorrenciaDeclaracao)
  if (cat.includes('RECUPERA')) return 'RECUPERACAO'
  if (cat.includes('DEVOLU') || cat.includes('ENTREGA')) return 'DEVOLUCAO'
  if (tipo.includes('RECUPERA')) return 'RECUPERACAO'
  if (tipo.includes('DEVOLU')) return 'DEVOLUCAO'
  if (tipo.includes('ROUBO') || tipo.includes('FURTO')) return 'ROUBO'
  if (cat.includes('ROUBO') || cat.includes('FURTO')) return 'ROUBO'
  // DECLARACAO sem tipo legivel ainda e a abertura de um caso: tratar como
  // roubo mantem a historia de pe, so sem dizer se foi roubo ou furto.
  if (cat.includes('DECLARA')) return 'ROUBO'
  return null
}

function tipoInicialDe(o: RegistroOcorrencia): 'ROUBO' | 'FURTO' | null {
  const alvo = `${texto(o?.tipoOcorrenciaDeclaracao)} ${texto(o?.categoriaOcorrencia)}`
  if (alvo.includes('FURTO')) return 'FURTO'
  if (alvo.includes('ROUBO')) return 'ROUBO'
  return null
}

function ms(data: string): number {
  const d = new Date(data)
  return Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime()
}

function limpo(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

/**
 * Agrupa os registros em episodios, na ordem das datas. Um episodio comeca num
 * roubo ou furto e absorve as recuperacoes e devolucoes seguintes, ate o
 * proximo roubo. Recuperacao ou devolucao sem roubo antes (base incompleta,
 * que acontece) vira episodio proprio, rotulado pelo que ela e: engolir esse
 * registro no episodio errado contaria uma historia que o dado nao sustenta.
 *
 * Registro sem data vai pro fim: sem data ele nao pode ordenar nada, mas
 * tambem nao pode sumir do relatorio.
 */
export function agruparEpisodios(lista: RegistroOcorrencia[] | null | undefined): EpisodioRoubo[] {
  if (!Array.isArray(lista) || !lista.length) return []

  const etapas = lista
    .map((o) => {
      const etapa = etapaDoRegistro(o)
      if (!etapa) return null
      return {
        etapa,
        data: String(o?.dataOcorrencia ?? ''),
        marcaModelo: limpo(o?.nomeMarcaModeloNoRegistroOcorrencia),
        cor: limpo(o?.nomeCorNoRegistroOcorrencia),
        uf: limpo(o?.ufJurisdicaoNoRegistroOcorrencia),
        _ordem: ms(String(o?.dataOcorrencia ?? '')),
        _tipo: tipoInicialDe(o),
      }
    })
    .filter(Boolean) as (RegistroEtapa & { _ordem: number; _tipo: 'ROUBO' | 'FURTO' | null })[]

  etapas.sort((a, b) => a._ordem - b._ordem)

  const episodios: EpisodioRoubo[] = []
  let atual: EpisodioRoubo | null = null

  for (const e of etapas) {
    const registro: RegistroEtapa = {
      etapa: e.etapa, data: e.data, marcaModelo: e.marcaModelo, cor: e.cor, uf: e.uf,
    }
    const abreNovo = e.etapa === 'ROUBO' || !atual
    if (abreNovo) {
      atual = {
        tipoInicial: e.etapa === 'ROUBO' ? (e._tipo ?? 'ROUBO') : null,
        etapaInicial: e.etapa,
        registros: [registro],
        encerrado: e.etapa === 'DEVOLUCAO',
        duracaoDias: null,
      }
      episodios.push(atual)
      continue
    }
    atual.registros.push(registro)
    if (e.etapa === 'DEVOLUCAO') atual.encerrado = true
  }

  for (const ep of episodios) {
    const ini = ms(ep.registros[0]!.data)
    const fim = ms(ep.registros[ep.registros.length - 1]!.data)
    ep.duracaoDias = Number.isFinite(ini) && Number.isFinite(fim) && fim >= ini
      ? Math.round((fim - ini) / 86400000)
      : null
  }

  return episodios
}

/** "1 dia" e nao "1 dias": o relatorio e lido em voz alta pro vendedor. */
export function plural(dias: number): string {
  return dias === 1 ? '1 dia' : `${dias} dias`
}

/** Todo episodio encerrado = o historico existe mas nao ha nada pendente. */
export function tudoEncerrado(episodios: EpisodioRoubo[]): boolean {
  return episodios.length > 0 && episodios.every((e) => e.encerrado)
}
