import { varrerRetentativasTardias } from '../utils/detran-retentativa-tardia'
import { ambienteForaDeProd } from '../utils/ambiente-alerta'

// Retentativa tardia do DETRAN (605/609): varredura a cada 5 min, so prod.
// Regra em server/utils/detran-retentativa-tardia.ts.
export default defineNitroPlugin(() => {
  if (import.meta.dev || process.env.VITEST) return
  let config: any
  try { config = useRuntimeConfig() } catch { return }
  if (ambienteForaDeProd(config)) return
  let rodando = false
  const t = setInterval(async () => {
    if (rodando) return
    rodando = true
    try {
      const ids = await varrerRetentativasTardias(usePremiumSupabase())
      if (ids.length) console.warn(`[detran-tardia] ${ids.length} retentativa(s) disparada(s)`)
    } finally { rodando = false }
  }, 5 * 60 * 1000)
  t.unref?.()
})
