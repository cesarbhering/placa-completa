import { assertAdminSecret } from '../../utils/admin-secret'
import { resumoPresenca } from '../../utils/presenca'

// Operator-only (x-admin-secret; without it, 404): who is on the site right
// now, for the "Agora no site" card of the office TV. The TV collector
// (pc-tv-presenca on the host) calls it every 30 s through the local Traefik.
// Counts only: tabs seen in the last 2 minutes, per route pattern ("outra"
// for any other path, "checkout" when the checkout is open) and per device
// category. No id, no IP, nothing about any one visitor.
//   POST (no body) -> { online, por_pagina: [{ path, n }], por_dispositivo, janela_s, atualizado_em }
export default defineEventHandler((event) => {
  assertAdminSecret(event)
  setHeader(event, 'cache-control', 'no-store')
  return resumoPresenca()
})
