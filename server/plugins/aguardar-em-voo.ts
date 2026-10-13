import { aguardarEmVoo, quantasEmVoo, marcarEncerrando, estaEncerrando, pararDeAceitar, TETO_ESPERA_MS } from '../utils/tarefas-em-voo'
import { redeSegurancaBoot, ATRASO_MS } from '../utils/rede-seguranca-boot'
import { ambienteForaDeProd } from '../utils/ambiente-alerta'

// Deploy espera as buscas em andamento (regra do Cesar, 13/out).
//
// O shutdown nativo do Nitro (node-server) fecha o listener HTTP logo no
// SIGTERM. A troca do Coolify e rolling e o Traefik faz round-robin entre o
// container antigo e o novo enquanto o antigo estiver de pe: fechar o listener
// derrubaria parte do trafego. Por isso o shutdown do Nitro fica DESLIGADO
// (NITRO_SHUTDOWN_DISABLED=1, no Dockerfile e aqui) e o SIGTERM e tratado assim:
//  1. marca "encerrando": /api/app-status responde 503 e o healthcheck tira o
//     container do balanceamento;
//  2. continua servindo HTTP e aceitando tarefa pos-entrega normalmente;
//  3. espera as tarefas em voo zerarem (teto 120 s; o Coolify espera 150 s);
//  4. chama os hooks 'close' do Nitro e sai.
//
// Boot: ATRASO_MS depois de subir, a rede de seguranca reenfileira a busca de
// multas de pedido entregue na ultima hora que ficou sem bloco. So em prod.

export function instalarEncerramento(
  nitroApp: { hooks: { callHook: (n: string) => Promise<any> } },
  deps: { processo?: Pick<NodeJS.Process, 'once'>; sair?: (codigo: number) => void; tetoMs?: number; log?: (m: string) => void } = {},
) {
  const processo = deps.processo ?? process
  const sair = deps.sair ?? ((c: number) => process.exit(c))
  const teto = deps.tetoMs ?? TETO_ESPERA_MS
  const log = deps.log ?? ((m: string) => console.log(m))
  const aoSinal = async (sinal: string) => {
    if (estaEncerrando()) return
    marcarEncerrando()
    const n = quantasEmVoo()
    log(`[em-voo] ${sinal}: app-status 503, servindo ate zerar; aguardando ${n} busca${n === 1 ? '' : 's'} (teto ${Math.round(teto / 1000)} s)`)
    await aguardarEmVoo(teto, { log })
    pararDeAceitar()
    try { await nitroApp.hooks.callHook('close') } catch (e: any) { log(`[em-voo] hooks close falharam: ${e?.message || e}`) }
    log('[em-voo] saindo')
    sair(0)
  }
  processo.once('SIGTERM', () => { void aoSinal('SIGTERM') })
  processo.once('SIGINT', () => { void aoSinal('SIGINT') })
  return aoSinal
}

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev || process.env.VITEST) return
  // O Nitro le esta variavel DEPOIS de criar o app (plugins rodam antes).
  process.env.NITRO_SHUTDOWN_DISABLED = '1'
  instalarEncerramento(nitroApp)

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
