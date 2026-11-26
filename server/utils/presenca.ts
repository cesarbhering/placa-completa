import type { PaginaPresenca } from '../../shared/presenca'

// Who is on the site right now, in the memory of this process only.
//
// One entry per open tab: random tab id -> page (route pattern, see
// shared/presenca.ts), when it was last seen and the device category. No
// database, no IP, no user agent, nothing written to disk or to the log. A
// restart (deploy) starts empty and the open tabs fill it again within one
// heartbeat (30 s).
//
// Production runs ONE app container with one Node process, so this map is the
// whole site. During a deploy the old and the new container overlap for a
// moment and the count can come out low for about two minutes.
//
// Limits, so a script cannot use this to fill the server's memory:
// - an entry not refreshed for PRESENCA_JANELA_MS is gone;
// - an id refreshed again before PRESENCA_MIN_INTERVALO_MS is ignored (the
//   client never sends faster than every 10 s);
// - never more than PRESENCA_TETO entries: when full, a NEW id is dropped
//   (existing tabs keep refreshing).

export const PRESENCA_JANELA_MS = 2 * 60_000
export const PRESENCA_MIN_INTERVALO_MS = 5_000
export const PRESENCA_TETO = 5_000
// Expired entries are swept at most this often on the write path.
const LIMPEZA_MS = 10_000

export const DISPOSITIVOS = ['celular', 'tablet', 'computador', 'desconhecido'] as const
export type DispositivoPresenca = (typeof DISPOSITIVOS)[number]

type Entrada = { pagina: PaginaPresenca; visto: number; dispositivo: DispositivoPresenca }

const entradas = new Map<string, Entrada>()
let ultimaLimpeza = 0

function limpar(agora: number) {
  ultimaLimpeza = agora
  for (const [id, e] of entradas) {
    if (agora - e.visto > PRESENCA_JANELA_MS) entradas.delete(id)
  }
}

export type ResultadoPresenca = 'ok' | 'cedo' | 'cheio'

/** A visible tab says where it is. `id` and `pagina` must already be validated (shared/presenca.ts). */
export function registrarPresenca(id: string, pagina: PaginaPresenca, dispositivo: DispositivoPresenca, agora = Date.now()): ResultadoPresenca {
  if (agora - ultimaLimpeza >= LIMPEZA_MS) limpar(agora)
  const atual = entradas.get(id)
  if (atual) {
    if (agora - atual.visto < PRESENCA_MIN_INTERVALO_MS) return 'cedo'
    atual.pagina = pagina
    atual.visto = agora
    atual.dispositivo = dispositivo
    return 'ok'
  }
  if (entradas.size >= PRESENCA_TETO) {
    limpar(agora)
    if (entradas.size >= PRESENCA_TETO) return 'cheio'
  }
  entradas.set(id, { pagina, visto: agora, dispositivo })
  return 'ok'
}

export type ResumoPresenca = {
  online: number
  por_pagina: { path: PaginaPresenca; n: number }[]
  por_dispositivo: Record<DispositivoPresenca, number>
  janela_s: number
  atualizado_em: string
}

/** Counts only: how many tabs, per page (most first) and per device category. */
export function resumoPresenca(agora = Date.now()): ResumoPresenca {
  limpar(agora)
  const porPagina = new Map<PaginaPresenca, number>()
  const porDispositivo = Object.fromEntries(DISPOSITIVOS.map((d) => [d, 0])) as Record<DispositivoPresenca, number>
  for (const e of entradas.values()) {
    porPagina.set(e.pagina, (porPagina.get(e.pagina) ?? 0) + 1)
    porDispositivo[e.dispositivo] += 1
  }
  return {
    online: entradas.size,
    por_pagina: [...porPagina].map(([path, n]) => ({ path, n })).sort((a, b) => b.n - a.n || a.path.localeCompare(b.path)),
    por_dispositivo: porDispositivo,
    janela_s: PRESENCA_JANELA_MS / 1000,
    atualizado_em: new Date(agora).toISOString(),
  }
}

/** Device category from getDispositivo(); anything unexpected counts as unknown. */
export function dispositivoPresenca(v: unknown): DispositivoPresenca {
  return (DISPOSITIVOS as readonly unknown[]).includes(v) ? (v as DispositivoPresenca) : 'desconhecido'
}

// Crawlers that run our JS (Googlebot renders pages) and monitoring tools are
// not people on the site. "bot" only counts followed by / ; + ) or - (as in
// Googlebot/2.1, AdsBot-Google): a phone model such as "CUBOT X30" is a person.
const ROBO = /bot[/;+)-]|crawl|spider|slurp|headless|phantomjs|lighthouse|pagespeed|gtmetrix|pingdom|inspectiontool/i

export function pareceRobo(ua: string): boolean {
  return ROBO.test(ua)
}

/** Tests only. */
export function _zerarPresenca() {
  entradas.clear()
  ultimaLimpeza = 0
}
