import { hostname } from 'node:os'
import { randomBytes } from 'node:crypto'
import { rodarFotosDepois, rodarFotosRapido, agendaFotosRapida, FOTOS_INTERVALO_MS, FOTOS_RAPIDO_TICK_MS, FOTOS_RAPIDO_PAUSA_429_MS } from '../utils/fotos-depois'
import { emVoo } from '../utils/tarefas-em-voo'
import { avisarFotosNoRelatorio } from '../utils/aviso-fotos'

// Fotos do lote que chegam depois da venda (Cesar, 18/out/2026): a cada 30 min
// grava os foto_refs nas passagens do relatorio que ainda nao tinham foto.
// Logica e lock entre containers: server/utils/fotos-depois.ts.
// Rodada rapida (30/out/2026): pedido entregue ha ate 30 min com passagem sem
// foto e perguntado a cada 60 a 90 s; a entrega agenda a primeira ~60 s depois.
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
  const tentadoRapido = new Map<string, number>()
  let rodando = false
  let rodandoRapido = false

  const buscar = (body: { fonte: string; lote: string; ref?: string }) => $fetch(`${base}/v1/fotos-do-lote`, {
    method: 'POST',
    headers: { 'X-API-Key': key, 'X-Origem': config.public.gated ? 'homolog-premium' : 'prod-premium' },
    body,
    timeout: 8000,
  })
  // E-mail ao cliente quando chegam fotos: so com FOTOS_AVISO_EMAIL=1
  // (desligado ate o Cesar aprovar o texto, 18/out/2026).
  const avisar = process.env.FOTOS_AVISO_EMAIL === '1'
    ? { avisar: (pedidoId: string, niveis: string[]) => avisarFotosNoRelatorio(usePremiumSupabase(), pedidoId, niveis).then((r) => console.info(`[fotos-depois] aviso ${pedidoId}: ${r}`)) }
    : {}

  const rodada = async () => {
    if (rodando) return
    rodando = true
    try {
      // Rapida no meio (no maximo 8 chamadas): espera ela acabar, pra nao somar as duas na chave.
      for (let i = 0; i < 30 && rodandoRapido; i++) await new Promise((ok) => setTimeout(ok, 1000))
      // Registrada em voo: deploy espera a rodada terminar (teto 120 s).
      await emVoo('fotos-depois', () => rodarFotosDepois({
        supabase: usePremiumSupabase(),
        dono,
        fontesSemFoto,
        tentadoEm,
        buscar,
        ...avisar,
      }).then((r) => {
        // 429 na rodada de 30 min: a rapida tambem segura (mesma chave).
        if (r.limitada) agendaFotosRapida.adiar(Date.now() + FOTOS_RAPIDO_PAUSA_429_MS)
        if (r.rodou && !r.apiAusente) console.info(`[fotos-depois] rodada: pedidos=${r.pedidos} chamadas=${r.chamadas} gravados=${r.gravados}`)
      }))
    } catch (e: any) {
      console.warn('[fotos-depois] falhou (fail-open):', e?.message || e)
    } finally { rodando = false }
  }

  // Rodada rapida: a batida so confere a agenda; nunca junto com a de 30 min
  // no mesmo container (as duas dividem a chave da API).
  const rodadaRapida = async () => {
    if (rodandoRapido || rodando || !agendaFotosRapida.devido(Date.now())) return
    rodandoRapido = true
    agendaFotosRapida.comecou()
    try {
      await emVoo('fotos-depois-rapido', () => rodarFotosRapido({
        supabase: usePremiumSupabase(),
        dono,
        fontesSemFoto,
        tentadoRapido,
        buscar,
        ...avisar,
      }).then((r) => {
        agendaFotosRapida.terminou(r.proximaEm)
        if (r.rodou && r.chamadas) console.info(`[fotos-depois rapido] rodada: pedidos=${r.pedidos} chamadas=${r.chamadas} gravados=${r.gravados}`)
      }))
    } catch (e: any) {
      agendaFotosRapida.terminou(Date.now() + 60_000)
      console.warn('[fotos-depois rapido] falhou (fail-open):', e?.message || e)
    } finally { rodandoRapido = false }
  }
  setInterval(() => { void rodadaRapida() }, FOTOS_RAPIDO_TICK_MS)

  // Primeira rodada 3 a 6 min depois do boot (fora do pico da troca de container).
  setTimeout(() => { void rodada() }, 180_000 + Math.floor(Math.random() * 180_000))
  setInterval(() => { void rodada() }, FOTOS_INTERVALO_MS)
})
