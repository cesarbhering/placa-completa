import { hostname } from 'node:os'
import { randomBytes } from 'node:crypto'
import { ambienteDaConsultaPaga } from '../utils/gcc-reserva'
import { consultarCompra, consultarPedidoGoogle, consumirCompra } from '../utils/google-play'
import { GP_INTERVALO_MS, ordensBloqueadasDoEnv, rodarJobGooglePlay } from '../utils/google-play-compras'
import { emVoo } from '../utils/tarefas-em-voo'

// Compras do app que ficaram sem pedido (pendente na Play, RTDN sem chamada do
// app): a cada 2 min pergunta a Google e conclui; alerta em 10 min; desiste em
// 72 h. Logica e lock: server/utils/google-play-compras.ts.
// Nao roda no staging (mesma regra do fotos-depois) nem sem a conta de servico
// da Play. GOOGLE_PLAY_JOB_DESLIGADO=1 desliga.
const AVISO = 'cesarcbhering@gmail.com'

export default defineNitroPlugin(() => {
  const config: any = useRuntimeConfig()
  if (process.env.GOOGLE_PLAY_JOB_DESLIGADO === '1') return
  if (config.public?.staging) return
  if (!config.googlePlayServiceAccount || !config.premiumSupabaseUrl || !config.premiumSupabaseKey) return

  const dono = `${hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`
  let rodando = false

  const rodada = async () => {
    if (rodando) return
    rodando = true
    try {
      await emVoo('google-play-compras', () => rodarJobGooglePlay({
        supabase: usePremiumSupabase(),
        dono,
        consultar: consultarCompra,
        consultarPedido: consultarPedidoGoogle,
        processar: processarPedidoPago,
        consumir: consumirCompra,
        ambienteDoPedido: (a) => ambienteDaConsultaPaga(a, config),
        ordensBloqueadas: ordensBloqueadasDoEnv(),
        alertar: (assunto, linhas) => sendErrorEmail({
          endpoint: '/premium/google-play (job)',
          errorMessage: [assunto, ...linhas].join('<br>'),
          paraTambem: [AVISO],
        }),
      }).then((r) => {
        if (r.rodou && (r.vistas || r.alertas)) console.info(`[google-play] rodada: vistas=${r.vistas} entregues=${r.entregues} desistencias=${r.desistencias} alertas=${r.alertas}`)
      }))
    } catch (e: any) {
      console.warn('[google-play] job falhou (fail-open):', e?.message || e)
    } finally { rodando = false }
  }

  setTimeout(() => { void rodada() }, 60_000 + Math.floor(Math.random() * 60_000))
  setInterval(() => { void rodada() }, GP_INTERVALO_MS)
})
