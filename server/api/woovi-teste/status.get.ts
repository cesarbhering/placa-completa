import { exigirTesteWooviLiberado } from '../../utils/woovi-teste-guard'

// Status ao vivo da cobranca de teste, com o corpo cru junto.
export default defineEventHandler(async (event) => {
  exigirTesteWooviLiberado()

  const id = String(getQuery(event).id || '').trim()
  if (!id) throw createError({ statusCode: 400, message: 'id obrigatorio' })

  const c = useRuntimeConfig()
  const base = String(c.wooviBase || '').replace(/\/+$/, '')
  const appId = String(c.wooviAppId || '')
  if (!appId) throw createError({ statusCode: 503, message: 'Woovi sem AppID configurado.' })

  try {
    const res = await $fetch<any>(`${base}/api/v1/charge/${encodeURIComponent(id)}`, {
      headers: { Authorization: appId, Accept: 'application/json' },
    })
    const charge = res?.charge || res
    return { status: charge?.status || null, cru: res }
  } catch (e: any) {
    return { status: null, erro: String(e?.data?.message || e?.message || e) }
  }
})
