// GWM/Haval: o cadastro cola o tipo de hibrido e a versao num token so. Caso
// THX8888 (22/out/2026): "I/GWM HAVAL H6 HEV2" ficou ambiguo entre as quatro
// H6 da FIPE; o certo e "Haval H6 2 1.5 (Hibrido)" (096001-2). Regra do Cesar
// (mesmo padrao da Toyota, shared/toyota-nome.ts):
//   HEV<n> = hibrido convencional (sem recarga), PHEV<n> = hibrido plug-in;
//   o numero <n> casa com o numero da versao FIPE ("H6 2", "H6 19", "H6 35");
//   GT casa so com GT. Sigla presente e eliminatoria (versaoDoNome).
// Lista real da FIPE 2026 (fipe-api): "Haval H6 2 1.5 (Hibrido)" (HEV),
// "Haval H6 19 1.5 (Hibrido)" (PHEV), "Haval H6 35 1.5 AWD" (PHEV) e
// "Haval H6 GT 1.5 AWD (Hibrido)" (PHEV). So o 35 e o GT sao AWD.

export interface FatosGwm {
  /** 'hev' (convencional) ou 'phev' (plug-in), quando o nome diz. */
  hibrido: 'hev' | 'phev' | null
  /** Numero da versao FIPE ("2", "19", "35"). */
  versao: string | null
  gt: boolean
}

const MARCAS_GWM = new Set(['GWM', 'HAVAL', 'GREATWALL', 'GREAT'])
const norm = (t: string) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')

function palavras(descricao: string): { marca: string; resto: string[] } {
  const d = String(descricao || '').toUpperCase().replace(/^(?:IMP|IMPORT|I)\s*\//, '')
  if (d.includes('/')) return { marca: norm(d.slice(0, d.indexOf('/'))), resto: d.slice(d.indexOf('/') + 1).split(/\s+/).filter(Boolean) }
  const p = d.split(/\s+/).filter(Boolean)
  return { marca: norm(p[0] || ''), resto: p.slice(1) }
}

export function fatosGwm(descricao: string | null | undefined): FatosGwm | null {
  const { marca, resto } = palavras(String(descricao || ''))
  if (!MARCAS_GWM.has(marca)) return null
  const f: FatosGwm = { hibrido: null, versao: null, gt: false }
  let achou = false
  for (const bruta of resto) {
    const n = norm(bruta)
    const m = n.match(/^(P?HEV)(\d{1,2})?$/)
    if (m) {
      f.hibrido = m[1] === 'PHEV' ? 'phev' : 'hev'
      if (m[2]) f.versao = String(Number(m[2]))
      achou = true
      continue
    }
    if (n === 'GT') { f.gt = true; achou = true }
  }
  return achou ? f : null
}

/** Siglas de versao pra versaoDoNome (eliminatorias): o numero e/ou GT. */
export function versoesGwm(descricao: string | null | undefined): string[] {
  const f = fatosGwm(descricao)
  if (!f) return []
  return [...(f.versao ? [f.versao] : []), ...(f.gt ? ['GT'] : [])]
}

/** O nome FIPE tem o numero de versao como palavra solta ("H6 2 1.5": "2" sim, "1.5" nao)? */
export function candidatoTemNumeroGwm(modelo: string, numero: string): boolean {
  return String(modelo || '').split(/\s+/).some((p) => p === numero)
}

/** Filtro GWM: numero da versao, GT so com GT, HEV sem AWD. Cada passo so vale se sobrar alguem. */
export function filtrarGwm<T extends { modelo: string }>(lista: T[], descricao: string | null | undefined): T[] {
  const f = fatosGwm(descricao)
  if (!f) return lista
  const so = (l: T[], fn: (c: T) => boolean) => { const r = l.filter(fn); return r.length ? r : l }
  let r = lista
  if (f.versao) r = so(r, (c) => candidatoTemNumeroGwm(c.modelo, f.versao!))
  r = f.gt ? so(r, (c) => /\bGT\b/i.test(c.modelo)) : so(r, (c) => !/\bGT\b/i.test(c.modelo))
  if (f.hibrido === 'hev' && !f.versao) r = so(r, (c) => !/\bAWD\b/i.test(c.modelo))
  return r
}

export const LEGENDA_GWM = 'GWM/Haval: o cadastro cola o tipo de hibrido e a versao, ex. "HAVAL H6 HEV2" = Haval H6 versao 2 (hibrido convencional, HEV); "PHEV19"/"PHEV35" = versoes 19 e 35 (hibrido plug-in). O numero casa com o numero da versao FIPE ("H6 2", "H6 19", "H6 35"). GT casa so com GT.'
