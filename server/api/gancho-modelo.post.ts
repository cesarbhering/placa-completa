import { acharModelo, fraseGanchoModelo } from '../../shared/gancho-modelo'
import { listaLeilaoModelos } from '../utils/gancho-modelo'

// Gancho por modelo da consulta gratis. Entra marca e modelo (os que a tela ja
// mostra), sai a frase ou nada. Nunca devolve a quantidade nem fala da placa:
// e a mesma informacao para todo dono do mesmo modelo.
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const marca = String(body?.marca || '').slice(0, 40)
  const modelo = String(body?.modelo || '').slice(0, 80)
  if (!marca || !modelo) return { frase: null }
  const lista = await listaLeilaoModelos(useSupabaseServer())
  const linha = acharModelo(lista, marca, modelo)
  return { frase: linha ? fraseGanchoModelo(marca, linha.modelo) : null }
})
