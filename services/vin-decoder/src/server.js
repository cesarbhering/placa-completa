// Servico interno de decode de VIN/chassi. Sem porta publica — so a rede
// docker interna (o Nuxt chama via http://vin-decoder:3000). Sem auth: a
// rede docker interna e o perimetro de seguranca aqui, igual outros servicos
// internos da VPS (ex: /opt/evolution).
import Fastify from 'fastify'
import { decodeVin } from './decode.js'
import { db } from './db.js'
import { PLANTS_VERSAO, aplicarPlantas } from '../scripts/plants-br.mjs'

const PORT = Number(process.env.PORT || 3000)
const app = Fastify({ logger: true })

// A tabela curada de plantas entra sozinha no start, quando o banco esta vazio
// ou ficou pra tras da versao do arquivo. Deixar isso como passo manual pos
// deploy significa esquecer no proximo rebuild, e o sintoma seria mudo: o
// relatorio simplesmente para de mostrar a cidade, sem erro nenhum.
function sincronizarPlantas() {
  try {
    const gravada = Number(db.prepare("SELECT valor FROM meta WHERE chave = 'plants_versao'").get()?.valor || 0)
    const vazia = db.prepare('SELECT count(*) c FROM plants').get().c === 0
    if (!vazia && gravada >= PLANTS_VERSAO) return
    const n = aplicarPlantas()
    app.log.info(`plantas sincronizadas: ${n} linhas, versao ${gravada || 'nenhuma'} -> ${PLANTS_VERSAO}`)
  } catch (err) {
    // Falha aqui nao pode derrubar o servico: sem a tabela, o decode continua
    // devolvendo montadora e pais, so nao mostra a cidade.
    app.log.error({ err }, 'nao foi possivel sincronizar a tabela de plantas')
  }
}
sincronizarPlantas()

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
