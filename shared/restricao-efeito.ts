// Item 12 do Relatorio 2.0 (Cesar, 14/out): cada restricao diz O QUE ela
// bloqueia (transferencia, licenciamento, circulacao). "Bloqueia" so quando o
// dado informa o tipo (RENAJUD com tipo, roubo/furto, gravame...); quando o
// tipo nao vem, "Pode bloquear" (sem afirmar alem do dado). Nunca nome de
// parte nem numero de processo.

export type Bloqueio = 'transferência' | 'licenciamento' | 'circulação'

export interface EfeitoRestricao {
  bloqueia: Bloqueio[]
  /** 'informado' = o dado diz o tipo; 'possivel' = depende do que nao veio. */
  certeza: 'informado' | 'possivel'
  nota: string | null
}

const T: Bloqueio[] = ['transferência']
const TL: Bloqueio[] = ['transferência', 'licenciamento']
const TLC: Bloqueio[] = ['transferência', 'licenciamento', 'circulação']

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s_-]+/g, ' ')

/** Efeito pelo tipo/texto da restricao (DETRAN, RENAJUD ou base nacional). null = nao e restricao que bloqueia. */
export function efeitoRestricao(e: { tipo?: string | null; texto?: string | null }): EfeitoRestricao | null {
  const t = `${norm(e.tipo)} ${norm(e.texto)}`
  if (/ROUBO|FURTO/.test(t)) return { bloqueia: TLC, certeza: 'informado', nota: 'O veículo pode ser apreendido em fiscalização.' }
  if (/BUSCA E APREENS/.test(t)) return { bloqueia: TLC, certeza: 'informado', nota: 'Há ordem para recolher o veículo.' }
  if (/CIRCULACAO/.test(t)) return { bloqueia: TLC, certeza: 'informado', nota: 'O veículo não pode rodar e pode ser recolhido.' }
  if (/LICENCIAMENTO/.test(t) && /RENAJUD|JUDIC|BLOQUEIO|RESTRICAO DE LICENCIAMENTO|^ *LICENCIAMENTO/.test(t)) return { bloqueia: TL, certeza: 'informado', nota: null }
  if (/PENHORA/.test(t)) return { bloqueia: T, certeza: 'informado', nota: 'O veículo garante uma dívida no processo e pode ir a leilão judicial.' }
  if (/TRANSFERENCIA/.test(t) && /RENAJUD|JUDIC|BLOQUEIO|^ *TRANSFERENCIA/.test(t)) return { bloqueia: T, certeza: 'informado', nota: null }
  if (/ALIENACAO|GRAVAME|FINANCEIR|ARRENDAMENTO|RESERVA DE DOMINIO|PENHOR\b|\bSNG\b|LEASING/.test(t)) return { bloqueia: T, certeza: 'informado', nota: 'Até a quitação e a baixa do gravame pela financeira.' }
  if (/TRIBUT|BENEFICIO|ISENCAO|ZONA FRANCA|\bZFM\b|CONV 64/.test(t)) return { bloqueia: T, certeza: 'possivel', nota: 'Antes do fim do prazo de carência do benefício fiscal.' }
  if (/RENAJUD|JUDIC/.test(t)) return { bloqueia: TLC, certeza: 'possivel', nota: 'Depende do tipo de restrição que o juiz registrou.' }
  if (/ADMINISTR|BLOQUEIO/.test(t)) return { bloqueia: TL, certeza: 'possivel', nota: 'Depende do motivo registrado pelo órgão.' }
  if (/BAIXAD|BAIXA DEFINITIVA/.test(t)) return { bloqueia: TLC, certeza: 'informado', nota: 'Registro baixado: o veículo deixa de existir legalmente.' }
  return null
}

/** "Bloqueia: transferência e licenciamento." / "Pode bloquear: ..." */
export function textoEfeito(ef: EfeitoRestricao | null): string | null {
  if (!ef || !ef.bloqueia.length) return null
  const l = ef.bloqueia
  const lista = l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0]
  return `${ef.certeza === 'informado' ? 'Bloqueia' : 'Pode bloquear'}: ${lista}.${ef.nota ? ' ' + ef.nota : ''}`
}
