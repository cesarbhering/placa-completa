// Linha do tempo unica do veiculo no relatorio pago (pedido do Cesar, 14/out,
// "Relatorio 2.0" item 2). Junta, em ordem, o que hoje esta espalhado em varios
// cards: fabricacao, leiloes, roubo/recuperacao/devolucao, recalls (com km),
// leituras de hodometro, licenciamento e multas por ano.
//
// So dado do VEICULO: nada de proprietario. O 1o emplacamento fica de fora de
// proposito (a fonte devolve ora o 1o, ora o atual; ver ficha cadastral).
// Copy: "consta", nunca afirma defeito; sem travessao.

export type TipoEvento = 'fabricacao' | 'leilao' | 'notificacao' | 'roubo' | 'recuperacao' | 'devolucao' | 'recall' | 'km' | 'licenciamento' | 'multas' | 'revenda_frota'
export type TomEvento = 'alerta' | 'atencao' | 'neutro' | 'ok'

export interface EventoTempo {
  /** ISO (aaaa-mm-dd) ou so o ano (aaaa); null = sem data, vai pro fim. */
  data: string | null
  /** Data pronta pra tela: dd/mm/aaaa, mm/aaaa ou aaaa. */
  quando: string
  tipo: TipoEvento
  titulo: string
  detalhe?: string
  tom: TomEvento
  /** Chave da secao do relatorio que detalha (numSecao), quando houver. */
  secao?: 'ocorr' | 'leilao' | 'restr' | 'frota'
}

/** 'aaaa-mm-dd...', 'dd/mm/aaaa', 'aaaa' -> ISO aaaa-mm-dd (ou aaaa). null se nao der. */
export function paraIso(v: unknown): string | null {
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})$/)
  return m ? m[1] : null
}

function quandoDe(iso: string | null): string {
  if (!iso) return 'sem data'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

const km = (n: number) => `${Math.round(n).toLocaleString('pt-BR')} km`
const reais = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export interface EntradaLinhaDoTempo {
  /** FIPE da versao no mes de uma data ISO (13a). Leilao e roubo ganham "FIPE na data". Nunca valor de arremate. */
  fipeNaData?: (iso: string | null) => number | null
  anoFabricacao?: number | string | null
  anoModelo?: number | string | null
  /** judicial: "Levado a leilão judicial"; intervalo: "voltou a leilão 7 meses depois" (recorrencia da API). */
  leiloes?: { data: string | null; titulo: string; detalhe?: string; notificacao?: boolean; confirmado?: boolean; judicial?: boolean; intervalo?: string | null }[]
  /** Registros de roubo/furto por etapa (ROUBO, RECUPERACAO, DEVOLUCAO). */
  roubo?: { etapa: string; data: string | null; tipo?: string | null }[]
  /** Atendimentos de recall da montadora (realizados), com km quando houver. */
  recallsAtendidos?: { data: string | null; titulo?: string | null; km?: number | null }[]
  /** Campanhas de recall em aberto com data de registro. */
  recallsAbertos?: { data: string | null; titulo?: string | null }[]
  /** Leituras de hodometro do DETRAN (vistorias). */
  hodometro?: { data: string | null; km: number }[]
  licenciamento?: { ano: number | string | null; emissao?: string | null } | null
  multas?: { data: string | null; valorCentavos?: number | null }[]
  /** Revenda de frota (nao e leilao): entrada no estoque e saida (provavel venda). */
  revendasFrota?: { data: string | null; saiuEm?: string | null; km?: number | null; condicao?: string | null; precoVsFipe?: string | null }[]
}

export function montarLinhaDoTempo(e: EntradaLinhaDoTempo): EventoTempo[] {
  const ev: EventoTempo[] = []
  const add = ({ quandoFixo, ...x }: Omit<EventoTempo, 'quando'> & { quandoFixo?: string }) => ev.push({ ...x, quando: quandoFixo || quandoDe(x.data) })

  if (e.anoFabricacao) {
    const mod = e.anoModelo && String(e.anoModelo) !== String(e.anoFabricacao) ? ` (ano-modelo ${e.anoModelo})` : ''
    add({ data: String(e.anoFabricacao), tipo: 'fabricacao', titulo: `Fabricado em ${e.anoFabricacao}${mod}`, tom: 'neutro' })
  }

  const fipeTxt = (iso: string | null) => {
    const v = e.fipeNaData ? e.fipeNaData(iso) : null
    return v && v > 0 ? `FIPE na data: ${reais(Math.round(v * 100))}` : null
  }
  for (const l of e.leiloes || []) {
    const iso = paraIso(l.data)
    add({
      data: iso, tipo: l.notificacao ? 'notificacao' : 'leilao', secao: 'leilao',
      titulo: l.notificacao ? 'Consta em edital de notificação' : l.judicial ? 'Levado a leilão judicial' : l.confirmado ? 'Consta passagem por leilão' : 'Possível passagem por leilão',
      detalhe: [l.notificacao ? null : l.intervalo ? l.intervalo.charAt(0).toUpperCase() + l.intervalo.slice(1) : null, l.titulo, l.detalhe, l.notificacao ? null : fipeTxt(iso)].filter(Boolean).join(' · ') || undefined,
      tom: l.notificacao ? 'neutro' : l.confirmado ? 'alerta' : 'atencao',
    })
  }

  for (const r of e.roubo || []) {
    const et = String(r.etapa || '').toUpperCase()
    if (et === 'ROUBO') add({ data: paraIso(r.data), tipo: 'roubo', secao: 'ocorr', titulo: `Registro de ${String(r.tipo || '').toUpperCase() === 'FURTO' ? 'furto' : 'roubo'}`, detalhe: fipeTxt(paraIso(r.data)) || undefined, tom: 'alerta' })
    else if (et === 'RECUPERACAO') add({ data: paraIso(r.data), tipo: 'recuperacao', secao: 'ocorr', titulo: 'Registro de recuperação', tom: 'atencao' })
    else if (et === 'DEVOLUCAO') add({ data: paraIso(r.data), tipo: 'devolucao', secao: 'ocorr', titulo: 'Registro de devolução ao proprietário', tom: 'ok' })
  }

  for (const r of e.recallsAbertos || []) {
    add({ data: paraIso(r.data), tipo: 'recall', secao: 'restr', titulo: 'Campanha de recall registrada', detalhe: r.titulo || undefined, tom: 'atencao' })
  }
  for (const r of e.recallsAtendidos || []) {
    add({
      data: paraIso(r.data), tipo: 'recall', secao: 'restr', titulo: 'Recall atendido na concessionária',
      detalhe: [r.titulo, r.km != null && Number.isFinite(Number(r.km)) ? `com ${km(Number(r.km))}` : null].filter(Boolean).join(' · ') || undefined,
      tom: 'ok',
    })
  }

  // Hodometro: cada leitura, com o quanto rodou desde a anterior (e o alerta se caiu).
  const leituras = (e.hodometro || []).map((h) => ({ data: paraIso(h.data), km: Number(h.km) }))
    .filter((h) => Number.isFinite(h.km)).sort((a, b) => String(a.data).localeCompare(String(b.data)))
  // Leitura que e a propria visita de recall (mesma data e km) nao repete: o
  // evento do recall ja mostra o km; ela so entra na conta do "rodou".
  const doRecall = new Set((e.recallsAtendidos || []).filter((r) => r.km != null).map((r) => `${paraIso(r.data)}|${Number(r.km)}`))
  leituras.forEach((h, i) => {
    const ant = i > 0 ? leituras[i - 1].km : null
    const caiu = ant != null && h.km < ant
    if (!caiu && doRecall.has(`${h.data}|${h.km}`)) return
    add({
      data: h.data, tipo: 'km',
      titulo: `Hodômetro registrado: ${km(h.km)}`,
      detalhe: ant == null ? undefined : caiu ? `menor que a leitura anterior (${km(ant)}): confira o painel e as revisões` : `rodou ${km(h.km - ant)} desde a leitura anterior`,
      tom: caiu ? 'alerta' : 'neutro',
    })
  })

  for (const r of e.revendasFrota || []) {
    add({
      data: paraIso(r.data), tipo: 'revenda_frota', secao: 'frota', titulo: 'Anunciado em revenda de frota',
      detalhe: [r.km ? `${km(r.km)} no anúncio` : null, r.precoVsFipe, r.condicao].filter(Boolean).join(' · ') || undefined,
      tom: 'neutro',
    })
    if (r.saiuEm) add({ data: paraIso(r.saiuEm), tipo: 'revenda_frota', secao: 'frota', titulo: 'Saiu do estoque da revenda (provável venda)', tom: 'neutro' })
  }

  if (e.licenciamento?.ano) {
    add({
      data: paraIso(e.licenciamento.emissao) || String(e.licenciamento.ano), tipo: 'licenciamento',
      titulo: `Licenciamento ${e.licenciamento.ano} emitido`, tom: 'neutro',
    })
  }

  // Multas: uma linha por ano, com quantidade e total.
  const porAno = new Map<string, { n: number; c: number; ult: string }>()
  for (const m of e.multas || []) {
    const ano = (paraIso(m.data) || '').slice(0, 4)
    if (!ano) continue
    const a = porAno.get(ano) || { n: 0, c: 0, ult: '' }
    a.n++; a.c += Number(m.valorCentavos) || 0
    const iso = paraIso(m.data) || ''
    if (iso > a.ult) a.ult = iso
    porAno.set(ano, a)
  }
  // Ordena pela ultima infracao do ano (nao no 1o de janeiro), mas mostra so o ano.
  for (const [ano, a] of porAno) {
    add({ data: a.ult || ano, quandoFixo: ano, tipo: 'multas', secao: 'restr', titulo: `${a.n} ${a.n === 1 ? 'multa' : 'multas'} em ${ano}`, detalhe: a.c > 0 ? `total ${reais(a.c)}` : undefined, tom: 'atencao' })
  }

  // Ordem cronologica (o mais antigo primeiro); sem data no fim. Mesmo dia/ano:
  // a ordem de entrada (fabricacao, leilao, roubo...) desempata.
  return ev
    .map((x, i) => ({ x, i }))
    .sort((a, b) => {
      if (!a.x.data !== !b.x.data) return a.x.data ? -1 : 1
      const da = String(a.x.data || ''), db = String(b.x.data || '')
      // so o ano (aaaa) vem antes das datas cheias do mesmo ano
      const c = da.slice(0, 4).localeCompare(db.slice(0, 4)) || (da.length - db.length) || da.localeCompare(db)
      return c || a.i - b.i
    })
    .map((p) => p.x)
}
