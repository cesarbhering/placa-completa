// Adaptador do emissor de NFS-e (servico proprio). Nunca bloqueia a entrega do
// relatorio: quem chama usa `void emVoo(...)`. Timeout curto, sem retry.
// Nao loga a chave nem o corpo das chamadas.
export interface NfseEmitirParams {
  referencia: string
  valorCentavos: number
  /** YYYY-MM-DD */
  competencia: string
  descricao: string
  tomador?: { documento: string; nome: string }
  email?: string | null
  metadados?: Record<string, string>
}

export interface NfseNota {
  id: string
  referencia: string
  estado: string
  numero?: string | null
  serie?: string | null
  chave_acesso?: string | null
  emitida_em?: string | null
  cancelada_em?: string | null
  erro?: { codigo: string; mensagem: string } | null
  links?: { pdf: string; xml: string } | null
}

export interface NfseProvedor {
  emitir(p: NfseEmitirParams): Promise<{ id: string; estado: string }>
  consultar(id: string): Promise<NfseNota>
  cancelar(id: string, motivo: string): Promise<void>
  pdf(id: string): Promise<Buffer>
}

/** Rede, timeout, 5xx ou 429: vale tentar de novo depois. */
export class ErroNfseIndisponivel extends Error {
  constructor(mensagem = 'emissor de NFS-e indisponivel') {
    super(mensagem)
    this.name = 'ErroNfseIndisponivel'
  }
}

/** Outros 4xx: o emissor recusou, repetir igual nao adianta. */
export class ErroNfseRejeitado extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(`emissor de NFS-e rejeitou (${status})`)
    this.name = 'ErroNfseRejeitado'
    this.status = status
    this.body = body
  }
}

export function descricaoDaNota(p: { plano?: string | null; placa: string; pedidoId: string }): string {
  const nome = p.plano === 'basica' ? 'Básico' : 'Completo'
  return `Consulta veicular por placa: relatório ${nome} com dados cadastrais, débitos, restrições e histórico de leilão do veículo de placa ${p.placa}. Pedido ${p.pedidoId.slice(0, 8)}.`
}

type Fetcher = (url: string, opts?: any) => Promise<any>
type Config = { nfseUrl?: string; nfseApiKey?: string }

function traduzir(e: any): never {
  const status = Number(e?.statusCode ?? e?.status ?? e?.response?.status ?? 0)
  // 401/403/404/405: configuracao (chave, URL); tentar de novo depois. 409 segue
  // rejeitado (quem cancela precisa dele).
  if (!status || status >= 500 || status === 429 || [401, 403, 404, 405].includes(status)) throw new ErroNfseIndisponivel()
  throw new ErroNfseRejeitado(status, e?.data ?? e?.response?._data ?? null)
}

export function provedorNfse(
  config: Config = useRuntimeConfig() as Config,
  fetcher: Fetcher = $fetch as unknown as Fetcher,
): NfseProvedor {
  const base = String(config.nfseUrl || '').replace(/\/+$/, '')
  async function chamar(path: string, opts: Record<string, any> = {}) {
    try {
      return await fetcher(`${base}${path}`, {
        ...opts,
        headers: { Authorization: `Bearer ${config.nfseApiKey || ''}` },
        timeout: 3000,
        retry: 0,
      })
    } catch (e) {
      return traduzir(e)
    }
  }
  return {
    async emitir(p) {
      const body: Record<string, unknown> = {
        referencia: p.referencia,
        valor_centavos: p.valorCentavos,
        competencia: p.competencia,
        descricao: p.descricao,
      }
      if (p.tomador) body.tomador = p.tomador
      if (p.email) body.email = p.email
      if (p.metadados) body.metadados = p.metadados
      const r = await chamar('/v1/notas', { method: 'POST', body })
      return { id: r.id, estado: r.estado }
    },
    consultar: (id) => chamar(`/v1/notas/${encodeURIComponent(id)}`),
    async cancelar(id, motivo) {
      await chamar(`/v1/notas/${encodeURIComponent(id)}/cancelar`, { method: 'POST', body: { motivo } })
    },
    async pdf(id) {
      const r = await chamar(`/v1/notas/${encodeURIComponent(id)}/pdf`, { responseType: 'arrayBuffer' })
      return Buffer.from(r)
    },
  }
}
