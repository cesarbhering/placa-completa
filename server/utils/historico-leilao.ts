// Historico de passagem por leilao (servico leiloes-api, rede docker).
//
// FAIL-OPEN, igual ao vin-decoder: timeout curto e qualquer erro devolvem null,
// e o relatorio sai sem a secao. Um relatorio pago nunca pode falhar porque um
// servico auxiliar caiu.
//
// A chamada e SEMPRE server-side: a key vive no runtime config privado e nunca
// entra no bundle. Sem `leiloesApiUrl` configurada a funcao nem tenta, que e
// como a feature fica restrita ao homolog por enquanto.

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
   * Nome PUBLICO da fonte, ja resolvido pela API: "Detran SP" pra orgao,
   * "Leiloeira particular" pra casa privada. E este que vai pra tela; o `fonte`
   * cru fica so pra log, porque nome de leiloeira particular nao pode aparecer
   * pro cliente (regra do Cesar).
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
  comitente: string | null
  veiculo_na_fonte: Record<string, any> | null
  evidencias: string[]
  conflitos: string[]
  /** URLs de foto do lote, servidas pelo nosso armazenamento. */
  fotos: string[]
}

export interface HistoricoLeilao {
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
function sanear(res: any): HistoricoLeilao | null {
  if (!res || typeof res !== 'object' || !res.resumo) return null
  const brutas = Array.isArray(res.passagens) ? res.passagens : []
  const passagens: PassagemLeilao[] = brutas
    .filter((p: any) => p && NIVEIS.includes(p.nivel))
    .map((p: any) => ({
      nivel: p.nivel,
      score: Number(p.score) || 0,
      fonte: String(p.fonte || ''),
      fonte_tipo: String(p.fonte_tipo || ''),
      fonte_uf: texto(p.fonte_uf),
      // Sem fonte_exibicao (resposta de uma versao anterior da API), monta o
      // nome aqui: orgao pode ser nomeado ("detran_sp" vira "Detran SP"),
      // casa privada nunca, entao cai no rotulo generico.
      fonte_exibicao: texto(p.fonte_exibicao)
        || (p.fonte_tipo === 'detran' ? nomeDeOrgao(p.fonte) : 'Leiloeira particular'),
      gravidade: sanearGravidade(p.gravidade),
      detalhes: p.detalhes && typeof p.detalhes === 'object' && !Array.isArray(p.detalhes) ? p.detalhes : {},
      data_leilao: texto(p.data_leilao),
      ref: texto(p.ref),
      lote: texto(p.lote),
      valor: typeof p.valor === 'number' ? p.valor : null,
      situacao: texto(p.situacao),
      // Leiloeiro de casa PRIVADA nunca sai daqui, nem no JSON: o relatorio e
      // publico por token, entao filtrar so na tela deixaria o nome exposto pra
      // quem abrisse a resposta. A API ja zera, isto e a nossa garantia.
      leiloeiro: p.fonte_tipo === 'detran' ? texto(p.leiloeiro) : null,
      comitente: texto(p.comitente),
      veiculo_na_fonte: p.veiculo_na_fonte && typeof p.veiculo_na_fonte === 'object' ? p.veiculo_na_fonte : null,
      evidencias: Array.isArray(p.evidencias) ? p.evidencias.map(String) : [],
      // So http(s) e so do nosso dominio de midia: URL de terceiro aqui viraria
      // hotlink de leiloeira na pagina do cliente.
      fotos: Array.isArray(p.fotos)
        ? p.fotos.filter((f: any) => typeof f === 'string' && /^https:\/\//.test(f)).slice(0, 3)
        : [],
      conflitos: Array.isArray(p.conflitos) ? p.conflitos.map(String) : [],
    }))

  return {
    resumo: {
      tem_indicio: !!res.resumo.tem_indicio,
      nivel_max: NIVEIS.includes(res.resumo.nivel_max) ? res.resumo.nivel_max : null,
      n_confirmado: Number(res.resumo.n_confirmado) || 0,
      n_provavel: Number(res.resumo.n_provavel) || 0,
      n_possivel: Number(res.resumo.n_possivel) || 0,
      possiveis_ambiguos: Number(res.resumo.possiveis_ambiguos) || 0,
      fontes_com_passagem: Array.isArray(res.resumo.fontes_com_passagem)
        ? res.resumo.fontes_com_passagem.map(String)
        : [],
    },
    passagens,
    indice_atualizado_em: texto(res.indice_atualizado_em),
    aviso: texto(res.aviso),
  }
}

export async function consultarHistoricoLeilao(perfil: PerfilVeiculo): Promise<HistoricoLeilao | null> {
  const config = useRuntimeConfig()
  const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
  const key = String(config.leiloesApiKey || '')
  if (!base || !key) return null

  const body = corpo(perfil)
  // A API exige ao menos um identificador; sem nenhum, nem vale a chamada.
  if (!body.placa && !body.chassi && !body.renavam && !body.motor) return null

  try {
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
      timeout: Number(config.leiloesApiTimeoutMs) || 15000,
    })
    return sanear(res)
  } catch (e: any) {
    // Fora do ar, timeout, key errada, 5xx: tudo cai aqui. So um log.
    console.warn('[leiloes-api] historico falhou (fail-open):', e?.message)
    return null
  }
}
