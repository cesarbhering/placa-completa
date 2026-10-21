// Cambio que o NOME do veiculo no cadastro ja diz (camada 1 da desambiguacao
// manual x automatico da FIPE, aprovada pelo Cesar em 09/out).
//
// O cadastro escreve o cambio de varios jeitos, conforme a montadora:
//   - token solto: AT, AT6, CVT, DCT, AMT, MT, MT5, AUT, MEC, TIPTRONIC...
//   - colado na cilindrada: "1.4MT", "1.0AT"
//   - Chevrolet: "10TAT" / "10TMT" (1.0 turbo automatico / manual)
//   - Hyundai: "1.6M" / "1.6A" / "1.0M" (M = manual, A = automatico)
//   - Renault: colado no fim, "16A" / "20A" / "DYN20A" / "PR1616VA" / "4X2A"
//     (A = automatico) e "16M" / "DYN20M" (M = manual)
// Cuidado: "AUTH" (Logan Authentique) NAO e automatico; so token exato conta.
// Na Renault nem "AUT" e: "CLIO AUT 10", "LOGAN AUT 1016V" = Authentique (caso
// OUQ8G18, 15/out; em prod toda Renault com AUT era 1.0 ou Clio 1.6, e a
// Authentique nunca teve versao Aut. na FIPE).

export type Cambio = 'manual' | 'automatico'

const AUTO = new Set([
  'AT', 'AT4', 'AT5', 'AT6', 'AT7', 'AT8', 'AT9', 'AT10', 'CVT', 'DCT', 'DSG', 'AMT',
  'AUT', 'AUTO', 'AUTOM', 'AUTOMATICO', 'AUTOMATIC', 'TIPTRONIC', 'TIPTR', 'STEPTRONIC',
  'MULTIDRIVE', 'POWERSHIFT', 'DUALOGIC', 'IMOTION', 'EASYTRONIC', 'XTRONIC', 'ECVT',
  // Chevrolet solto: TAT = turbo automatico ("ONIX 1.0 TAT").
  'TAT',
])
// MT = manual transmission; TMT = turbo manual (Chevrolet). Na FIPE: "Mec." = manual, "Aut." = automatico
// (e a manual muitas vezes vem sem nada: ver candidatoEManual em server/utils/fipe-candidato.ts).
const MANUAL = new Set(['MT', 'MT5', 'MT6', 'TMT', 'MEC', 'MECANICO', 'MANUAL'])

/** Palavras do nome sem a marca ("HYUNDAI/HB20S 1.6M COMF" -> HB20S, 1.6M, COMF). */
function partes(descricao: string): { marca: string; tokens: string[] } {
  let d = String(descricao || '').toUpperCase().replace(/^I\s*\//, '')
  let marca = ''
  if (d.includes('/')) { marca = d.slice(0, d.indexOf('/')).trim(); d = d.slice(d.indexOf('/') + 1) }
  else { const p = d.split(/\s+/); marca = p[0] || ''; d = p.slice(1).join(' ') }
  return { marca, tokens: d.split(/[\s/]+/).filter(Boolean) }
}

function deUmToken(t: string, marca: string): Cambio | null {
  const limpo = t.replace(/[^A-Z0-9.]/g, '')
  const semPonto = limpo.replace(/\./g, '')
  if (/^REN(AULT?)?$/.test(marca)) {
    if (semPonto === 'AUT' || semPonto === 'AUTH') return null
    const ren = semPonto.match(/^(?:[A-Z]+)?\d{2}(?:\d{2}V?)?([AM])$|^4X[24]([AM])$/)
    if (ren) return (ren[1] || ren[2]) === 'A' ? 'automatico' : 'manual'
  }
  if (AUTO.has(semPonto)) return 'automatico'
  if (MANUAL.has(semPonto)) return 'manual'
  // Colado na cilindrada: "1.4MT", "1.0AT", "1.6AT6".
  const colado = limpo.match(/^\d\.\d(AT|MT|CVT|AMT)\d?$/)
  if (colado) return colado[1] === 'MT' ? 'manual' : 'automatico'
  // Chevrolet: "10TAT" / "10TMT" / "12TAT".
  // Sem o T (aspirado): "10MT" / "12AT" / "14AT" / "18AT".
  const chev = limpo.match(/^\d{2}T?(AT|MT)$/)
  if (chev) return chev[1] === 'AT' ? 'automatico' : 'manual'
  // Hyundai: "1.6M" / "1.6A" / "1.0M" (so na Hyundai: em outra marca a letra
  // solta depois da cilindrada pode ser outra coisa).
  if (/HYUNDAI|HYUND/.test(marca)) {
    const hy = limpo.match(/^\d\.\d(M|A)$/)
    if (hy) return hy[1] === 'A' ? 'automatico' : 'manual'
  }
  return null
}

/**
 * Cambio do nome do cadastro, ou null quando o nome nao diz (ou diz as duas
 * coisas, o que nao deveria acontecer e entao nao decide nada).
 */
export function cambioDoNome(descricao: string | null | undefined): Cambio | null {
  const { marca, tokens } = partes(String(descricao || ''))
  const achados = new Set(tokens.map((t) => deUmToken(t, marca)).filter(Boolean) as Cambio[])
  return achados.size === 1 ? [...achados][0] : null
}

/** Versao FIPE manual? ("Mec.") */
export function versaoFipeManual(modelo: string): boolean {
  return /\bMec\b|\bMec\./i.test(String(modelo || ''))
}

/**
 * Versao FIPE automatica? ("Aut." e os automatizados que a FIPE nomeia pelo
 * sistema: Dualogic, I-Motion, Easytronic, CVT, Tiptronic, Powershift, DSG).
 */
export function versaoFipeAutomatica(modelo: string): boolean {
  return /\bAut\b|\bAut\.|Dualogic|I-?Motion|Easytronic|\bCVT\b|Tiptronic|Powershift|\bDSG\b|Steptronic|Multidrive/i.test(String(modelo || ''))
}

/** Cambio de uma versao FIPE pelo nome, ou null. */
export function cambioDaVersaoFipe(modelo: string): Cambio | null {
  const m = versaoFipeManual(modelo), a = versaoFipeAutomatica(modelo)
  return m === a ? null : m ? 'manual' : 'automatico'
}

/**
 * Duvida que e SO de cambio: exatamente uma versao manual e uma automatica.
 * E o caso em que a tela pergunta "manual ou automatico?" (camada 3).
 */
export function opcoesDeCambio<T extends { modelo: string }>(versoes: T[]): { manual: T; automatico: T } | null {
  if (versoes.length !== 2) return null
  const man = versoes.filter((v) => cambioDaVersaoFipe(v.modelo) === 'manual')
  const aut = versoes.filter((v) => cambioDaVersaoFipe(v.modelo) === 'automatico')
  return man.length === 1 && aut.length === 1 ? { manual: man[0], automatico: aut[0] } : null
}
