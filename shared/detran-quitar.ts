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
  /** AL: IPVA apontado pelo DETRAN, valor ainda vindo da SEFAZ (ou nao veio). */
  ipva_pendente_sefaz?: boolean | null
  ipva_sefaz_indisponivel?: boolean | null
  /** UF sem consulta de debitos (RJ: exige o documento do dono). Nao e "nada a quitar". */
  debitos_indisponiveis?: boolean | null
  aviso_debitos?: string | null
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
  /** IPVA em aberto sem valor ainda: texto da linha (consultando / nao informado). */
  ipvaSemValor: string | null
  /** Aviso de debitos nao consultaveis na UF (RJ). */
  avisoDebitos: string | null
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

  // AL: o DETRAN aponta IPVA em aberto e o valor vem da SEFAZ (consulta lenta).
  const ipvaSemValor = ipva > 0 ? null
    : b.ipva_pendente_sefaz ? `consultando a SEFAZ${uf ? '-' + uf : ''}, o valor aparece ao recarregar a página`
      : b.ipva_sefaz_indisponivel ? `valor não informado pela SEFAZ${uf ? '-' + uf : ''} nesta consulta` : null

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
    // RJ: os debitos nao foram consultados (o estado exige o documento do dono),
    // entao nunca "nada a quitar".
    nadaAQuitar: totalCentavos > 0 || ipvaSemValor || b.debitos_indisponiveis ? null : `Nada a quitar no DETRAN${uf ? '-' + uf : ''} na data da consulta.`,
    ipvaSemValor,
    avisoDebitos: b.debitos_indisponiveis ? (b.aviso_debitos || 'Débitos deste estado não estão disponíveis nesta consulta.') : null,
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
 * Linhas de status quando NAO ha bloco estadual (DETRAN indisponivel ou
 * protegido): so o que a base nacional diz (feedback do Cesar, 14/out). Com
 * bloco estadual, a caixa "Para transferir" ja diz tudo e nao ha resumo.
 */
export function statusBaseNacional(a: { renainf: unknown; licAno: string | number | null | undefined }) {
  const rows: { rotulo: string; valor: string; emDia: boolean; alerta: boolean }[] = []
  if (a.renainf === true || a.renainf === false) {
    rows.push({ rotulo: 'Multas (base nacional)', valor: a.renainf ? 'Consta multa em aberto' : 'Nada consta', emDia: !a.renainf, alerta: !!a.renainf })
  }
  if (a.licAno != null && a.licAno !== '') rows.push({ rotulo: 'Último licenciamento (base nacional)', valor: String(a.licAno), emDia: false, alerta: false })
  return rows
}
