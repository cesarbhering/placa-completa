import { createHash } from 'node:crypto'
import { sanearLote } from '../../shared/eventos-funil'
import { getClientIp } from '../utils/client-ip'
import { getDispositivo } from '../utils/dispositivo'

/**
 * Coletor do funil. Recebe um lote pequeno de etapas do navegador e grava em
 * eventos_funil.
 *
 * Tres regras que nao mudam:
 * 1) fail-open. Este endpoint mede, nao serve produto: qualquer erro (Supabase
 *    fora, config faltando, corpo invalido) responde 204 e a pagina segue.
 *    Medicao nunca pode quebrar venda.
 * 2) allowlist. Nome fora de EVENTOS_FUNIL e descartado em silencio, porque a
 *    rota e publica e sem autenticacao.
 * 3) sem PII. O e-mail nunca chega aqui, o User-Agent vira categoria e o IP
 *    vira hash com sal do servidor, so pra dedupe.
 */
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 204)
  try {
    const eventos = sanearLote(await readBody(event).catch(() => null))
    if (!eventos.length) return null

    const cfg = useRuntimeConfig()
    if (!cfg.premiumSupabaseUrl || !cfg.premiumSupabaseKey) return null

    const { dispositivo, sistema } = getDispositivo(event)
    const ip = getClientIp(event)
    // Sem sal configurado nao guarda hash nenhum: um sha256 de IP sem sal e
    // quebravel por forca bruta (o espaco de IPv4 e pequeno), o que seria
    // guardar o IP com passos extras.
    const ipHash = cfg.funilIpSalt && ip !== 'unknown'
      ? createHash('sha256').update(cfg.funilIpSalt + ip).digest('hex').slice(0, 32)
      : null

    const linhas = eventos.map(e => ({ ...e, dispositivo, sistema, ip_hash: ipHash }))
    const supabase = usePremiumSupabase()
    const { error } = await supabase.from('eventos_funil').insert(linhas)
    if (error && import.meta.dev) console.warn('[evento] insert falhou:', error.message)
  } catch (e: any) {
    if (import.meta.dev) console.warn('[evento] ignorado:', e?.message || e)
  }
  return null
})
