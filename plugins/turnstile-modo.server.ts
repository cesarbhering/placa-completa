import { resolverModoTurnstile } from '../server/utils/turnstile'
import { TURNSTILE_MODO_STATE } from '../composables/useTurnstile'

// O client precisa saber o modo do Turnstile (off/log/enforce) pra decidir
// quanto esperar pelo token (composables/useTurnstile.ts, limitesEspera): em
// log o servidor nao barra, entao a espera e curta. O modo vive no
// runtimeConfig PRIVADO (NUXT_TURNSTILE_MODE, lido em runtime) e o runtimeConfig
// e congelado no Nitro, entao nao da pra espelhar no publico sem env nova.
// Aqui, so no servidor, o modo efetivo (sem secret = off) vai pro useState e
// chega ao client no payload da pagina. Nada de secret sai daqui.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  useState(TURNSTILE_MODO_STATE, () => resolverModoTurnstile(config.turnstileMode, config.turnstileSecret))
})
