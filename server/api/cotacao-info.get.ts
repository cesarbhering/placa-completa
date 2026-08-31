import { getSeguroEstimado } from '../utils/seguro-estimate'
import { marcaExibicao } from '../../shared/marca-exibicao'

const NOVENTA_DIAS_MS = 90 * 24 * 60 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const visible = local.slice(0, 2)
  return `${visible}***@${domain}`
}

/**
 * Dados de pre-preenchimento da pagina /cotacao a partir do link do email
 * (?c=<uuid da consulta>). Token invalido/expirado degrada silenciosamente
 * pra { generic: true } - nunca erro. A estimativa e recalculada na hora
 * (sempre atual, mesmo meses depois do email).
 */
export default defineEventHandler(async (event) => {
  const c = String(getQuery(event).c || '')
  if (!UUID_RE.test(c)) return { generic: true }

  const supabase = useSupabaseServer()
  const { data: consulta, error } = await supabase
    .from('consultas')
    .select('id, created_at, email, phone, channel, placa, geo_region_code, api_response')
    .eq('id', c)
    .maybeSingle()

  if (error || !consulta) return { generic: true }
  if (Date.now() - new Date(consulta.created_at).getTime() > NOVENTA_DIAS_MS) {
    return { generic: true }
  }

  const api = typeof consulta.api_response === 'string'
    ? JSON.parse(consulta.api_response)
    : (consulta.api_response || {})

  const marca = marcaExibicao(api)
  const modelo = api.MODELO || api.modelo || ''
  const ano = parseInt(String(api.anoModelo || api.ano || ''), 10) || null

  // codigo_modelo do melhor match FIPE (mesmo criterio do fluxo da consulta)
  const fipeDados = api.fipe?.dados || []
  const bestFipe = fipeDados.length
    ? fipeDados.reduce((best: any, item: any) => (item.score || 0) > (best.score || 0) ? item : best, fipeDados[0])
    : null

  let seguro = null
  if (bestFipe?.codigo_modelo && ano) {
    seguro = await getSeguroEstimado({
      codigoModelo: String(bestFipe.codigo_modelo),
      ano,
      regiaoCode: consulta.geo_region_code || null,
      marca,
      modelo,
    })
  }

  return {
    generic: false,
    veiculo: { placa: consulta.placa, marca, modelo, ano },
    emailMasked: consulta.email ? maskEmail(consulta.email) : null,
    phonePrefill: consulta.channel === 'whatsapp' ? consulta.phone : null,
    seguro,
  }
})
