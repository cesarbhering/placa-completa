import { depsReais } from '../utils/suporte/servidor'
import { rodarFilaN1, rodarInatividade } from '../utils/suporte/fluxo'

// Fila N1 do atendimento WhatsApp: a cada minuto repassa as respostas da
// equipe e escala ao N2 o que passou de 15 min. So com o suporte ligado.
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  if (!depsReais(config, null)) return
  let rodando = false
  setInterval(async () => {
    if (rodando) return
    rodando = true
    try {
      const deps = depsReais(config, usePremiumSupabase())
      if (deps) await rodarFilaN1(deps)
    } catch (e: any) {
      console.warn('[suporte] fila N1 falhou:', e?.message || e)
    } finally { rodando = false }
  }, 60_000)

  // Inatividade do cliente: a cada 5 min.
  let varrendo = false
  setInterval(async () => {
    if (varrendo) return
    varrendo = true
    try {
      const deps = depsReais(config, usePremiumSupabase())
      if (deps) {
        const r = await rodarInatividade(deps)
        if (r.perguntadas || r.encerradas) console.info(`[suporte] inatividade perguntadas=${r.perguntadas} encerradas=${r.encerradas}`)
      }
    } catch (e: any) {
      console.warn('[suporte] inatividade falhou:', e?.message || e)
    } finally { varrendo = false }
  }, 5 * 60_000)
})
