import {
  PARCEIRO_COOKIE, entrarComCodigo, entrarComToken, novoCookie, opcoesCookie, parceiroLigado, segredoParceiro,
} from '../../utils/parceiro-chassi'

// Ativa o acesso de parceiro neste aparelho: pelo token do link (navegador) ou
// por e-mail + codigo (app). POST de proposito: filtros de link de e-mail
// corporativo abrem o link antes da pessoa e queimariam o token num GET.
// Falha = mesma resposta generica, sem dizer o motivo.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig()
  const segredo = segredoParceiro(config as any)
  if (!parceiroLigado(config as any) || !segredo) return { ok: false }
  const body = await readBody(event).catch(() => null)
  const sb = useSupabaseServer()
  const parceiroId = body?.t
    ? await entrarComToken(sb, body.t)
    : await entrarComCodigo(sb, body?.email, body?.codigo)
  if (!parceiroId) return { ok: false }
  setCookie(event, PARCEIRO_COOKIE, novoCookie(segredo, parceiroId), opcoesCookie(getRequestHeader(event, 'host')))
  return { ok: true }
})
