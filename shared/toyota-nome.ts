// Toyota: o cadastro cola cabine, versao, cambio, tracao e combustivel num
// token so. Caso PRX0B70 (21/out/2026): "I/TOYOTA HILUX CDSRXA4FD" ficou
// ambiguo entre Hilux CD Mec., CD SR Aut., CD SRV Aut., CD SRX Aut. e Chassi;
// o certo e "Hilux CD SRX 4x4 2.8 TDI 16V Diesel Aut.". Regra do Cesar:
//   CD = cabine dupla (nunca "Chassi" nem cabine simples), CS = cabine simples,
//   SW/SW4 = Hilux SW4;
//   versao SRX/SRV/SR/STD/GR-S/Conquest/Limited casa so com a MESMA sigla
//   (SRX nunca casa com SRV nem com SR);
//   A = automatico, M = manual;
//   4FD = 4x4 diesel, 4FA = 4x4 flex/gasolina, 2FD/2FA = 4x2;
//   7L/5L = lugares (SW4).
// Usado por shared/versao-fipe.ts (versao, cabine, tracao) e
// shared/cambio-nome.ts (cambio). Sem import de nenhum dos dois.

export interface FatosToyota {
  cabine: 'dupla' | 'simples' | null
  sw4: boolean
  versao: string | null
  cambio: 'manual' | 'automatico' | null
  tracao: '4X4' | '4X2' | null
  combustivel: 'diesel' | 'flex' | null
  lugares: 5 | 7 | null
}

const MARCAS_TOYOTA = new Set(['TOYOTA', 'TOY'])

// Ordem importa: SRX/SRV antes de SR, GRS antes de nada parecido.
const RE_TOKEN = /^(CD|CS|SW4|SW)?(SRX|SRV|SR|STD|GRS|CONQUEST|CONQ|LIMITED)?([AM])?(4X4|4X2|[24]F[DA])?(7L|5L)?$/

const norm = (t: string) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')

function marcaEPalavras(descricao: string): { marca: string; palavras: string[] } {
  const d = String(descricao || '').toUpperCase().replace(/^I\s*\//, '')
  if (d.includes('/')) return { marca: norm(d.slice(0, d.indexOf('/'))), palavras: d.slice(d.indexOf('/') + 1).split(/\s+/).filter(Boolean) }
  const p = d.split(/\s+/).filter(Boolean)
  return { marca: norm(p[0] || ''), palavras: p.slice(1) }
}


/** Fatos do nome Toyota, ou null fora da Toyota / sem nenhum token reconhecido. */
export function fatosToyota(descricao: string | null | undefined): FatosToyota | null {
  const { marca, palavras } = marcaEPalavras(String(descricao || ''))
  if (!MARCAS_TOYOTA.has(marca)) return null
  const f: FatosToyota = { cabine: null, sw4: false, versao: null, cambio: null, tracao: null, combustivel: null, lugares: null }
  let achou = false
  for (const bruta of palavras) {
    const n = norm(bruta)
    // GR-S vira GRS no norm; "GR" sozinho fica pra versao-fipe (VERSOES).
    const m = n.match(RE_TOKEN)
    if (!m || !n) continue
    const [, cab, ver, camb, trac, lug] = m
    const grupos = [cab, ver, camb, trac, lug].filter(Boolean).length
    // Letra solta (A/M) sozinha nao e cambio: precisa vir colada em algo.
    if (!grupos || (grupos === 1 && camb)) continue
    achou = true
    if (cab === 'CD') f.cabine = 'dupla'
    else if (cab === 'CS') f.cabine = 'simples'
    else if (cab === 'SW' || cab === 'SW4') f.sw4 = true
    if (ver && !f.versao) f.versao = ver === 'CONQ' ? 'CONQUEST' : ver
    if (camb) f.cambio = camb === 'A' ? 'automatico' : 'manual'
    if (trac) {
      if (trac.startsWith('4X')) f.tracao = trac === '4X4' ? '4X4' : '4X2'
      else {
        f.tracao = trac[0] === '4' ? '4X4' : '4X2'
        f.combustivel = trac[2] === 'D' ? 'diesel' : 'flex'
      }
    }
    if (lug) f.lugares = lug === '7L' ? 7 : 5
  }
  return achou ? f : null
}

/** Cambio do token colado Toyota ("CDSRXA4FD" = automatico), ou null. */
export function cambioToyota(descricao: string | null | undefined): 'manual' | 'automatico' | null {
  return fatosToyota(descricao)?.cambio ?? null
}

/** Legenda pro prompt do juiz FIPE. */
export const LEGENDA_TOYOTA = 'Toyota (Hilux/SW4/Corolla): o cadastro cola tudo num token, ex. "HILUX CDSRXA4FD" = Hilux cabine dupla (CD), versao SRX, cambio automatico (A), 4x4 diesel (4FD). CD = cabine dupla (nunca "Chassi" nem cabine simples), CS = cabine simples, SW/SW4 = Hilux SW4; A = Aut., M = Mec.; 4FD = 4x4 diesel, 4FA = 4x4 flex/gasolina, 2FD/2FA = 4x2; 7L/5L = lugares. A versao (SRX, SRV, SR, STD, GR-S, Conquest, XEi, GLi, XRS, Altis) so casa com a MESMA sigla: SRX nunca e SRV nem SR.'
