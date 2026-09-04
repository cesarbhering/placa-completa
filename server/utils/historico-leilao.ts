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

export interface PassagemLeilao {
  nivel: NivelLeilao
  score: number
  fonte: string
  fonte_tipo: 'detran' | 'privado' | string
  fonte_uf: string | null
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
}

export interface HistoricoLeilao {
  resumo: {
    tem_indicio: boolean
    nivel_max: NivelLeilao | null
    n_confirmado: number
    n_provavel: number
    n_possivel: number
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
    cor: texto(perfil.cor),
    uf: texto(perfil.uf),
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
      data_leilao: texto(p.data_leilao),
      ref: texto(p.ref),
      lote: texto(p.lote),
      valor: typeof p.valor === 'number' ? p.valor : null,
      situacao: texto(p.situacao),
      leiloeiro: texto(p.leiloeiro),
      comitente: texto(p.comitente),
      veiculo_na_fonte: p.veiculo_na_fonte && typeof p.veiculo_na_fonte === 'object' ? p.veiculo_na_fonte : null,
      evidencias: Array.isArray(p.evidencias) ? p.evidencias.map(String) : [],
      conflitos: Array.isArray(p.conflitos) ? p.conflitos.map(String) : [],
    }))

  return {
    resumo: {
      tem_indicio: !!res.resumo.tem_indicio,
      nivel_max: NIVEIS.includes(res.resumo.nivel_max) ? res.resumo.nivel_max : null,
      n_confirmado: Number(res.resumo.n_confirmado) || 0,
      n_provavel: Number(res.resumo.n_provavel) || 0,
      n_possivel: Number(res.resumo.n_possivel) || 0,
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
      headers: { 'X-API-Key': key, 'X-Origem': 'homolog-premium' },
      body,
      timeout: 3000,
    })
    return sanear(res)
  } catch (e: any) {
    // Fora do ar, timeout, key errada, 5xx: tudo cai aqui. So um log.
    console.warn('[leiloes-api] historico falhou (fail-open):', e?.message)
    return null
  }
}
