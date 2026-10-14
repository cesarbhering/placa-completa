// Bloco do DETRAN no relatorio (14/out, aprovado pelo Cesar):
// 1) caixa "Para transferir este veiculo, falta quitar R$ X" no topo, com as
//    linhas por item, as restricoes que travam a transferencia e a
//    consequencia do licenciamento atrasado;
// 2) procedencia e data de cada subbloco (fonte + "consultado em").
// So o que o bloco ja tem: nada estimado, nada afirmado alem do dado.

export interface BlocoDetranQuitar {
  fonte?: string | null
  uf?: string | null
  multas_total_centavos?: number | null
  multas_atualizado_centavos?: number | null
  licenciamento_centavos?: number | null
  ipva_total_centavos?: number | null
  total_detran_centavos?: number | null
  licenciamento_atrasado_ano?: number | null
  alerta_roubo_furto?: string | null
  restricoes_detran?: { tipo: string; texto: string }[] | null
}

export interface ResumoQuitar {
  uf: string | null
  totalCentavos: number
  linhas: { rotulo: string; centavos: number }[]
  /** Total que o proprio DETRAN informou (BA): as linhas sao a composicao. */
  totalDoDetran: boolean
  travas: string[]
  consequencia: string | null
  /** "Nada a quitar no DETRAN-XX na data da consulta." quando total = 0. */
  nadaAQuitar: string | null
}

const pos = (v: any) => (Number(v) > 0 ? Math.round(Number(v)) : 0)

export function ufDoBlocoDetran(b: { uf?: string | null; fonte?: string | null } | null | undefined, ufVeiculo?: string | null): string | null {
  const u = String(b?.uf || /^detran_([a-z]{2})/i.exec(String(b?.fonte || ''))?.[1] || ufVeiculo || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(u) ? u : null
}

// Categorias que travam a transferencia (pedido do Cesar): roubo/furto,
// financiamento (alienacao/gravame), judicial e administrativa.
const CAT_DETRAN: Record<string, string> = {
  furto: 'Roubo ou furto', financeira: 'Financiamento (alienação ou gravame)', sng: 'Financiamento (alienação ou gravame)',
  judiciaria: 'Restrição judicial', administrativa: 'Restrição administrativa',
}
const CAT_NACIONAL: [RegExp, string][] = [
  [/ROUBO|FURTO/, 'Roubo ou furto'],
  [/ALIENACAO|ARRENDAMENTO|RESERVA_DE_DOMINIO|GRAVAME|PENHOR/, 'Financiamento (alienação ou gravame)'],
  [/RENAJUD|JUDICIAL|BUSCA_E_APREENSAO/, 'Restrição judicial'],
  [/ADMINISTRATIVA/, 'Restrição administrativa'],
]

export const CONSEQUENCIA_LICENCIAMENTO = 'Com o licenciamento atrasado, o documento do veículo está vencido e ele pode ser apreendido em fiscalização.'

export function resumoQuitar(a: {
  bloco: BlocoDetranQuitar
  ufVeiculo?: string | null
  /** restricoesItens da base nacional (cru) */
  restricoesNacionais?: unknown
  indicadorRouboFurto?: boolean
}): ResumoQuitar {
  const b = a.bloco || {}
  const uf = ufDoBlocoDetran(b, a.ufVeiculo)
  const multasOrig = pos(b.multas_total_centavos)
  const multas = pos(b.multas_atualizado_centavos) > multasOrig ? pos(b.multas_atualizado_centavos) : multasOrig
  const lic = pos(b.licenciamento_centavos)
  const ipva = pos(b.ipva_total_centavos)
  const linhas = [
    { rotulo: 'IPVA em aberto', centavos: ipva },
    { rotulo: 'Licenciamento em aberto', centavos: lic },
    { rotulo: 'Multas em aberto', centavos: multas },
  ].filter((l) => l.centavos > 0)
  const soma = linhas.reduce((s, l) => s + l.centavos, 0)
  const totalDoDetran = pos(b.total_detran_centavos) > 0
  const totalCentavos = totalDoDetran ? pos(b.total_detran_centavos) : soma

  const travas: string[] = []
  const add = (t: string) => { if (!travas.includes(t)) travas.push(t) }
  if (b.alerta_roubo_furto) add('Roubo ou furto')
  for (const r of b.restricoes_detran || []) { const c = CAT_DETRAN[String(r?.tipo || '')]; if (c) add(c) }
  if (a.indicadorRouboFurto) add('Roubo ou furto')
  for (const it of (Array.isArray(a.restricoesNacionais) ? a.restricoesNacionais : [])) {
    const k = String(it ?? '').toUpperCase().replace(/[\s-]+/g, '_')
    for (const [re, c] of CAT_NACIONAL) if (re.test(k)) { add(c); break }
  }

  return {
    uf,
    totalCentavos,
    linhas,
    totalDoDetran,
    travas,
    consequencia: b.licenciamento_atrasado_ano ? CONSEQUENCIA_LICENCIAMENTO : null,
    nadaAQuitar: totalCentavos > 0 ? null : `Nada a quitar no DETRAN${uf ? '-' + uf : ''} na data da consulta.`,
  }
}

/** "14/10/2026 13:50" em horario de Brasilia, a partir de ISO. */
export function dataHoraBrt(iso: string | null | undefined): string | null {
  const t = iso ? new Date(iso) : null
  if (!t || Number.isNaN(t.getTime())) return null
  const f = (o: Intl.DateTimeFormatOptions) => t.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', ...o })
  return `${f({ day: '2-digit', month: '2-digit', year: 'numeric' })} ${f({ hour: '2-digit', minute: '2-digit', hour12: false })}`
}

/** Linha de procedencia do subbloco de debitos e multas. */
export function procedenciaDebitos(a: { uf: string | null; consultadoEm?: string | null; estado: 'ok' | 'protegido' | 'indisponivel' }): string {
  const fonte = `DETRAN${a.uf ? '-' + a.uf : ''}`
  const quando = dataHoraBrt(a.consultadoEm)
  const rotulo = a.estado === 'ok' ? 'consultado em' : 'tentativa em'
  return `Débitos e multas · ${fonte}${quando ? ` · ${rotulo} ${quando}` : ''}`
}

/** Linha de procedencia da quilometragem: fontes distintas + data da ultima leitura. */
export function procedenciaKm(a: { uf: string | null; fontes: string[]; ultimaData?: string | null }): string {
  const nomes: string[] = []
  for (const f of a.fontes) {
    const n = f === 'DETRAN' ? `DETRAN${a.uf ? '-' + a.uf : ''}` : f
    if (!nomes.includes(n)) nomes.push(n)
  }
  return `Quilometragem · ${nomes.join(' + ')}${a.ultimaData ? ` · última leitura ${a.ultimaData}` : ''}`
}

/**
 * Resumo por item abaixo da caixa (14/out): so STATUS, sem os valores que a
 * caixa "Para transferir" ja mostra. Multas/IPVA/licenciamento com valor em
 * aberto = "Em aberto" (licenciamento: "Atrasado (ano)" ou "vence dd/mm/aaaa");
 * zerado = "Em dia" / "Nada consta". MG: ultimo exercicio/IPVA pago, neutro.
 */
export function statusResumoDetran(m: any, opts: { renainfForaTexto?: string | null; anoAtual?: number } = {}) {
  const rows: { rotulo: string; valor: string; emDia: boolean; alerta?: boolean; texto?: string }[] = []
  if (!m) return rows
  const atual = opts.anoAtual ?? new Date().getFullYear()
  const isoBr = (iso: any) => { const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return x ? `${x[3]}/${x[2]}/${x[1]}` : null }
  if (opts.renainfForaTexto) rows.push({ rotulo: 'Multas em aberto', valor: '', emDia: false, texto: opts.renainfForaTexto })
  else if (m.multas_total_centavos != null) {
    const aberto = pos(m.multas_total_centavos) > 0
    rows.push({
      rotulo: String(m.fonte || '').startsWith('detran_') ? 'Multas' : 'Multas (Pix)',
      valor: aberto ? 'Em aberto' : 'Nada consta', emDia: !aberto, alerta: aberto,
    })
  }
  if (m.licenciamento_centavos != null || m.ultimo_licenciamento_ano != null || m.licenciamento_atrasado_ano != null) {
    const atrasado = m.licenciamento_atrasado_ano
    const ultimo = m.ultimo_licenciamento_ano
    const venc = isoBr(m.licenciamento_venc)
    const aberto = pos(m.licenciamento_centavos) > 0
    const anterior = !atrasado && ultimo != null && ultimo < atual
    const valor = atrasado ? `Atrasado (${atrasado})`
      : aberto ? (venc ? `Em aberto, vence ${venc}` : 'Em aberto')
      : anterior ? `Último: ${ultimo}` : 'Em dia'
    rows.push({ rotulo: 'Licenciamento', valor, emDia: !atrasado && !aberto && !anterior, alerta: !!atrasado || aberto })
  }
  if (m.ipva_total_centavos != null) {
    const aberto = pos(m.ipva_total_centavos) > 0
    rows.push({ rotulo: 'IPVA', valor: aberto ? 'Em aberto' : 'Em dia', emDia: !aberto, alerta: aberto })
  } else if (m.ipva_pago_ano != null) rows.push({ rotulo: 'IPVA', valor: `Último pago: ${m.ipva_pago_ano}`, emDia: false })
  return rows
}
