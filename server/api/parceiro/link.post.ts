import { parceiroLigado, solicitarLink } from '../../utils/parceiro-chassi'
import { montarEmailParceiro } from '../../utils/parceiro-chassi-email'
import { comTagAmbiente } from '../../utils/ambiente-alerta'

// Pedido de link de acesso de parceiro. A resposta e SEMPRE a mesma (nao
// revela quem esta na lista), inclusive com a feature desligada. Rate limit
// por IP no middleware (5/h).
export const RESPOSTA_LINK = 'Se este e-mail estiver cadastrado como parceiro, enviamos um link de acesso. Confira a caixa de entrada e o spam.'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const body = await readBody(event).catch(() => null)
  const config = useRuntimeConfig()
  if (parceiroLigado(config as any) && config.resendApiKey) {
    const base = String(config.premiumBaseUrl || 'https://placacompleta.com.br').replace(/\/$/, '')
    await solicitarLink(useSupabaseServer(), body?.email, async (para, { token, codigo }) => {
      const { assunto, html, texto } = montarEmailParceiro({ link: `${base}/parceiro/entrar?t=${token}`, codigo })
      await $fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: { from: 'PlacaCompleta <contato@placacompleta.com.br>', reply_to: 'contato@placacompleta.com.br', to: [para], subject: comTagAmbiente(assunto, config), html, text: texto },
      })
    })
  }
  return { ok: true, mensagem: RESPOSTA_LINK }
})
