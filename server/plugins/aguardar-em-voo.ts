import { pararDeAceitar, aguardarEmVoo, quantasEmVoo, TETO_ESPERA_MS } from '../utils/tarefas-em-voo'
import { redeSegurancaBoot, ATRASO_MS } from '../utils/rede-seguranca-boot'
import { ambienteForaDeProd } from '../utils/ambiente-alerta'

// Deploy espera as buscas em andamento (regra do Cesar, 13/out).
//
// SIGTERM: o Nitro (node-server) fecha o servidor pra conexoes novas e chama o
// hook 'close'. Aqui: para de aceitar tarefa pos-entrega nova e espera as em
// voo terminarem (teto 120 s). O teto geral do Nitro (NITRO_SHUTDOWN_TIMEOUT,
// padrao 30 s) mataria antes: o Dockerfile poe 130 s e, se faltar, setamos aqui
// (o Nitro le a variavel depois de criar o app). O Coolify espera 150 s antes
// do SIGKILL.
//
// Boot: ATRASO_MS depois de subir, a rede de seguranca reenfileira a busca de
// multas de pedido entregue na ultima hora que ficou sem bloco. So em prod.
export default defineNitroPlugin((nitroApp) => {
  if (!process.env.NITRO_SHUTDOWN_TIMEOUT) process.env.NITRO_SHUTDOWN_TIMEOUT = String(TETO_ESPERA_MS + 10_000)

  nitroApp.hooks.hook('close', async () => {
    pararDeAceitar()
    const n = quantasEmVoo()
    console.log(`[em-voo] SIGTERM: aguardando ${n} busca${n === 1 ? '' : 's'} (teto ${TETO_ESPERA_MS / 1000} s)`)
    await aguardarEmVoo(TETO_ESPERA_MS)
  })

  if (import.meta.dev || process.env.VITEST) return
  let config: any
  try { config = useRuntimeConfig() } catch { return }
  if (ambienteForaDeProd(config)) return
  const t = setTimeout(() => {
    void redeSegurancaBoot(usePremiumSupabase()).then((ids) => {
      if (ids.length) console.warn(`[boot] rede de seguranca reenfileirou ${ids.length} pedido(s)`)
    })
  }, ATRASO_MS)
  t.unref?.()
})
