import { ErroNfseIndisponivel, provedorNfse } from '../../../../utils/nfse-provedor'

// GET /api/premium/nfse/<token>/pdf: serves the issued note's PDF, proxied from
// the issuer. The token is never logged.
interface Deps {
  token: string
  flag: string
  carregar: (token: string) => Promise<any>
  pdf: (nfseId: string) => Promise<Buffer>
}

const naoEncontrado = () => createError({ statusCode: 404 })

export async function servirPdf(d: Deps) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(d.token)) throw naoEncontrado()
  if (d.flag !== 'on') throw naoEncontrado()
  const pedido = await d.carregar(d.token)
  if (!pedido?.nfse_id || !['emitida', 'cancelada'].includes(pedido.nfse_status)) throw naoEncontrado()
  let body: Buffer
  try {
    body = await d.pdf(pedido.nfse_id)
  } catch (e) {
    if (e instanceof ErroNfseIndisponivel) {
      throw createError({ statusCode: 503, message: 'Nota fiscal temporariamente indisponível. Tente de novo em alguns minutos.' })
    }
    throw naoEncontrado()
  }
  return {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="nfse-${pedido.nfse_numero || pedido.id}.pdf"`,
      // A cancellation changes the PDF: always revalidate.
      'Cache-Control': 'private, no-cache',
    },
    body,
  }
}

export default defineEventHandler(async (event) => {
  const token = String(getRouterParam(event, 'token') || '')
  const config = useRuntimeConfig()
  const r = await servirPdf({
    token,
    flag: String(config.nfse || ''),
    carregar: async (tok) => {
      const { data } = await usePremiumSupabase()
        .from('pedidos_premium')
        .select('id,nfse_id,nfse_status,nfse_numero')
        .eq('token_entrega', tok)
        .maybeSingle()
      return data
    },
    pdf: (id) => provedorNfse().pdf(id),
  })
  for (const [k, v] of Object.entries(r.headers)) setHeader(event, k, v)
  return r.body
})
