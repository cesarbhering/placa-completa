import { exigirTesteWooviLiberado } from '../../utils/woovi-teste-guard'

// Paga a cobranca no ambiente de teste da Woovi. Existe endpoint pra isso
// (GET /openpix/testing?transactionID=...), e ele so funciona com AppID de
// sandbox: com credencial de producao a Woovi recusa, que e o que a gente quer.
export default defineEventHandler(async (event) => {
  exigirTesteWooviLiberado()

  const body = await readBody(event).catch(() => ({}))
  const id = String(body?.id || '').trim()
  if (!id) throw createError({ statusCode: 400, message: 'id obrigatorio' })

  const ok = await simularPagamento(id)
  return { ok }
})
