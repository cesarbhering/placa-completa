import { emVoo, quantasEmVoo } from '../../utils/tarefas-em-voo'
import { assertAdminSecret } from '../../utils/admin-secret'

// SO HOMOLOG: segura uma tarefa em voo por N segundos (max 140), sem chamar
// nada externo. Serve pra provar que o SIGTERM espera (docker stop -t 150).
// Fora do homolog ou sem o x-admin-secret: 404.
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig().public?.homolog) throw createError({ statusCode: 404, message: 'Not Found' })
  assertAdminSecret(event)
  const body = await readBody(event).catch(() => ({}))
  const s = Math.max(1, Math.min(140, Number(body?.segundos) || 60))
  void emVoo(`teste-${s}s`, async () => {
    console.log(`[em-voo] teste: dormindo ${s} s`)
    await new Promise((r) => setTimeout(r, s * 1000))
    console.log(`[em-voo] teste: acordei depois de ${s} s`)
  })
  return { ok: true, segundos: s, em_voo: quantasEmVoo() }
})
