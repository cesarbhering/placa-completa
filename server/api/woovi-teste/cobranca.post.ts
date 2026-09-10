import { exigirTesteWooviLiberado } from '../../utils/woovi-teste-guard'

// Cria uma cobranca de teste na Woovi e devolve a resposta CRUA junto com o
// que a tela usa. O cru e o ponto da pagina: e olhando pra ele que a gente
// descobre o nome do recebedor, a chave e o formato da expiracao, que sao
// exatamente as duvidas que sobraram da leitura da doc.
export default defineEventHandler(async (event) => {
  exigirTesteWooviLiberado()

  const body = await readBody(event).catch(() => ({}))
  const centavos = Math.min(Math.max(Number(body?.centavos) || 100, 100), 5000)

  const c = useRuntimeConfig()
  const base = String(c.wooviBase || '').replace(/\/+$/, '')
  const appId = String(c.wooviAppId || '')
  if (!appId) throw createError({ statusCode: 503, message: 'Woovi sem AppID configurado.' })

  // correlationID proprio da pagina de teste, com prefixo: assim uma cobranca
  // de teste nunca colide com o id de um pedido de verdade.
  const correlationID = `teste-${crypto.randomUUID()}`

  const res = await $fetch<any>(`${base}/api/v1/charge`, {
    method: 'POST',
    headers: { Authorization: appId, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: {
      correlationID,
      value: centavos,
      comment: 'Teste PlacaCompleta',
      expiresIn: 900,
    },
  })

  const charge = res?.charge || {}
  return {
    correlationID,
    identifier: charge.identifier || null,
    brCode: charge.brCode || res?.brCode || null,
    qrCodeImage: charge.qrCodeImage || null,
    status: charge.status || null,
    expiresDate: charge.expiresDate || null,
    // Resposta inteira, sem filtro: e pra isso que a pagina existe.
    cru: res,
  }
})
