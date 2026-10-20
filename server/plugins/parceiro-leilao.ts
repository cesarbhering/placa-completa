import { hostname } from 'node:os'
import { randomBytes } from 'node:crypto'
import { cfgParceiro, rodarJobParceiro, PARCEIRO_INTERVALO_MS } from '../utils/parceiro-leilao'
import { emVoo } from '../utils/tarefas-em-voo'

// Complemento da base parceira de leilao (20/out/2026): pedido cuja consulta
// falhou na geracao tenta de novo uma vez. Logica: server/utils/parceiro-leilao.ts.
// Nao roda no staging (mesma regra do fotos-depois) nem desligado.
export default defineNitroPlugin(() => {
  const config: any = useRuntimeConfig()
  if (config.public?.staging) return
  if (!config.premiumSupabaseUrl || !config.premiumSupabaseKey) return
  const dono = `${hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`
  let rodando = false
  const rodada = async () => {
    const cfg = cfgParceiro(useRuntimeConfig())
    if (rodando || !cfg.ligado) return
    rodando = true
    try {
      await emVoo('parceiro-leilao', () => rodarJobParceiro({ sb: usePremiumSupabase(), cfg, dono }).then((r) => {
        if (r.vistos) console.info(`[parceiro-leilao] rodada: vistos=${r.vistos} completados=${r.completados}`)
      }))
    } catch (e: any) {
      console.warn('[parceiro-leilao] job falhou (fail-open):', e?.message || e)
    } finally { rodando = false }
  }
  setTimeout(() => { void rodada() }, 240_000 + Math.floor(Math.random() * 120_000))
  setInterval(() => { void rodada() }, PARCEIRO_INTERVALO_MS)
})
