import { hostname } from 'node:os'
import { randomBytes } from 'node:crypto'
import { rodarFotosDepois, FOTOS_INTERVALO_MS } from '../utils/fotos-depois'
import { emVoo } from '../utils/tarefas-em-voo'

// Fotos do lote que chegam depois da venda (Cesar, 18/out/2026): a cada 30 min
// grava os foto_refs nas passagens do relatorio que ainda nao tinham foto.
// Logica e lock entre containers: server/utils/fotos-depois.ts.
// Nao roda no staging (codigo de outra branch falando com o banco de prod) nem
// sem a leiloes-api configurada. FOTOS_DEPOIS_DESLIGADO=1 desliga.
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  if (process.env.FOTOS_DEPOIS_DESLIGADO === '1') return
  if (config.public?.staging) return
  const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
  const key = String(config.leiloesApiKey || '')
  if (!base || !key || !config.premiumSupabaseUrl || !config.premiumSupabaseKey) return

  const dono = `${hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`
  const fontesSemFoto = new Set<string>()
  const tentadoEm = new Map<string, number>()
  let rodando = false

  const rodada = async () => {
    if (rodando) return
    rodando = true
    try {
      // Registrada em voo: deploy espera a rodada terminar (teto 120 s).
      await emVoo('fotos-depois', () => rodarFotosDepois({
        supabase: usePremiumSupabase(),
        dono,
        fontesSemFoto,
        tentadoEm,
        buscar: (body) => $fetch(`${base}/v1/fotos-do-lote`, {
          method: 'POST',
          headers: { 'X-API-Key': key, 'X-Origem': config.public.gated ? 'homolog-premium' : 'prod-premium' },
          body,
          timeout: 8000,
        }),
      }).then((r) => {
        if (r.rodou && !r.apiAusente) console.info(`[fotos-depois] rodada: pedidos=${r.pedidos} chamadas=${r.chamadas} gravados=${r.gravados}`)
      }))
    } catch (e: any) {
      console.warn('[fotos-depois] falhou (fail-open):', e?.message || e)
    } finally { rodando = false }
  }

  // Primeira rodada 3 a 6 min depois do boot (fora do pico da troca de container).
  setTimeout(() => { void rodada() }, 180_000 + Math.floor(Math.random() * 180_000))
  setInterval(() => { void rodada() }, FOTOS_INTERVALO_MS)
})
