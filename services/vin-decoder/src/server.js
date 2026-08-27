// Servico interno de decode de VIN/chassi. Sem porta publica — so a rede
// docker interna (o Nuxt chama via http://vin-decoder:3000). Sem auth: a
// rede docker interna e o perimetro de seguranca aqui, igual outros servicos
// internos da VPS (ex: /opt/evolution).
import Fastify from 'fastify'
import { decodeVin } from './decode.js'

const PORT = Number(process.env.PORT || 3000)
const app = Fastify({ logger: true })

app.get('/health', async () => ({ ok: true }))

app.get('/decode/:vin', async (req, reply) => {
  const result = decodeVin(req.params.vin)
  if (!result.valido) {
    reply.code(422)
    return result
  }
  return result
})

app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`vin-decoder ouvindo na porta ${PORT}`))
  .catch((err) => { app.log.error(err); process.exit(1) })
