import { emailValido } from '../../../../shared/intencao-play'
import { barrarPlacaBloqueada } from '../../../utils/blocklist'
import { normalizarPlaca, novoIdIntencao } from '../../../utils/google-play-compras'

// POST /api/premium/google-play/intencao { placa, email } -> { id }
//
// Chamado pelo checkout do app ANTES de abrir a folha da Play. Grava placa e
// e-mail aqui e devolve um id opaco, que o app manda como
// obfuscatedExternalAccountId da compra. Assim o servidor sabe o e-mail mesmo
// se o app morrer logo depois do pagamento e o pedido nascer pela RTDN
// (server/utils/google-play-compras.ts, buscarIntencao).
//
// No app o e-mail e obrigatorio; no site (Pix) continua opcional e nao passa aqui.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const body = await readBody(event)
  const placa = normalizarPlaca(body?.placa)
  const email = String(body?.email || '').trim().toLowerCase()
  if (!placa) throw createError({ statusCode: 400, message: 'Placa inválida.' })
  if (!email || email.length > 200 || !emailValido(email)) throw createError({ statusCode: 400, message: 'Informe um e-mail válido.' })
  barrarPlacaBloqueada(event, placa, email)

  const id = novoIdIntencao()
  const { error } = await usePremiumSupabase().from('google_play_intencoes').insert({ id, placa, email })
  if (error) throw createError({ statusCode: 500, message: 'Não foi possível iniciar a compra. Tente de novo.' })
  return { id }
})
