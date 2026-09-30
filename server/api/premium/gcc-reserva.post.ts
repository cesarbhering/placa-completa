import crypto from 'node:crypto'
import { ambienteDoCorpo } from '../../utils/gcc-reserva'

// Mantem a RESERVA de hash GCC ("2 de frente"). Batido pelo timer systemd
// (pc-gcc-reserva, a cada 10 min) e disparavel na mao. Roda: limpa reservas
// vencidas (desperdicio, loga) -> repoe ate o teto (2) -> atualiza a saude do
// GCC e dispara o alerta se estiver fora. A reposicao tambem acontece sozinha
// apos cada venda (fire-and-forget no senatran-consulta); o timer e a rede de
// seguranca pra quando nao ha vendas ou o GCC estava fora na hora.
//
// Auth: x-admin-secret (timing-safe). Sem ADMIN_SECRET no ambiente a rota nem
// existe (404, nao 401 — rota administrativa nao anuncia que existe).
export default defineEventHandler(async (event) => {
  const segredo = String(useRuntimeConfig().adminSecret || '')
  if (!segredo) throw createError({ statusCode: 404, message: 'Not Found' })
  const enviado = String(getRequestHeader(event, 'x-admin-secret') || '')
  const ok = enviado.length === segredo.length
    && crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))
  if (!ok) throw createError({ statusCode: 404, message: 'Not Found' })

  const body = await readBody(event).catch(() => ({}))
  // Ambiente OBRIGATORIO e explicito (sem default): o timer de prod manda
  // 'producao'; no homolog, um POST sem ambiente compraria hash real de prod.
  const ambiente = ambienteDoCorpo(body)
  if (!ambiente) throw createError({ statusCode: 400, message: "Informe ambiente: 'producao' ou 'homolog'." })

  const supabase = usePremiumSupabase()
  const vencidas = await limparReservaVencida(supabase, ambiente)
  const r = await reporReservaGcc(supabase, ambiente)

  return { ambiente, vencidas, ...r }
})
