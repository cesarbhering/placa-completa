// Faixa de licenciamento do relatorio (topo da ficha).
//
// Caso DEI0D43 (14/out): a faixa dizia "Atrasado" pela base nacional
// (ultimoLicenciamento 2023, defasada) e o bloco do DETRAN-SP, no mesmo
// relatorio, dizia licenciamento 2026 em dia. Regra do Cesar: quando o DETRAN
// da UF respondeu, ele manda (com a fonte no texto); sem ele, vale a base
// nacional com o aviso de que pode estar defasada.
//
// Tom pelo ano: exercicio atual (ou adiante) em dia; ano anterior pode so nao
// ter vencido ainda (o calendario corre pelo final da placa e varia por UF);
// dois anos ou mais e atraso. Se o parser da UF marcou atraso
// (licenciamento_atrasado_ano, que ja aplica o calendario da UF), e atraso.

export type TomLicenciamento = 'ok' | 'atencao' | 'alerta'

export interface FaixaLicenciamento {
  ano: string
  tom: TomLicenciamento
  rotulo: string
  /** " no DETRAN-SP" quando veio do estado; null pela base nacional. */
  fonte: string | null
  /** dd/mm/aaaa do licenciamento no DETRAN (so nas UFs que informam). */
  licenciadoEm: string | null
  /** Emissao do documento pela base nacional (so quando a faixa e nacional). */
  emissao: string | null
  nota: string | null
}

export const NOTA_BASE_NACIONAL = 'pela base nacional, que pode estar defasada; o DETRAN da UF é a referência'

export interface EstadualLicenciamento {
  uf?: string | null
  fonte?: string | null
  ultimo_licenciamento_ano?: number | null
  licenciamento_atrasado_ano?: number | null
  /** ISO YYYY-MM-DD */
  licenciamento_em?: string | null
}

function ufDoBloco(e: EstadualLicenciamento): string | null {
  const u = String(e.uf || /^detran_([a-z]{2})$/i.exec(String(e.fonte || ''))?.[1] || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(u) ? u : null
}

function isoParaBr(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

function tomDoAno(ano: number, atual: number): { tom: TomLicenciamento; rotulo: string; nota: string | null } {
  if (ano >= atual) return { tom: 'ok', rotulo: 'Em dia', nota: null }
  if (ano === atual - 1) return { tom: 'atencao', rotulo: 'Confira', nota: `O licenciamento ${atual} pode ainda estar no prazo do calendário da UF.` }
  return { tom: 'alerta', rotulo: 'Atrasado', nota: null }
}

export function faixaLicenciamento(a: {
  /** ultimoLicenciamento.anoLicenciamento da base nacional */
  anoNacional: string | number | null | undefined
  emissaoNacional?: string | null
  /** bloco do DETRAN da UF (so com status ok/sem_debito) */
  estadual?: EstadualLicenciamento | null
  anoAtual?: number
}): FaixaLicenciamento | null {
  const atual = a.anoAtual ?? new Date().getFullYear()
  const e = a.estadual
  // O ano mostrado e o ULTIMO LICENCIADO (ultimo_licenciamento_ano). O
  // licenciamento_atrasado_ano so marca que ha atraso (no backfill manual do
  // ORK8004 ele veio como o 1o ano em aberto, 2021, e o ultimo licenciado era 2020).
  const anoEst = e?.ultimo_licenciamento_ano ?? e?.licenciamento_atrasado_ano ?? null
  if (e && anoEst != null && Number.isFinite(Number(anoEst))) {
    const uf = ufDoBloco(e)
    const fonte = uf ? ` no DETRAN-${uf}` : ' no DETRAN da UF'
    const licenciadoEm = isoParaBr(e.licenciamento_em)
    // Base nacional com outro ano: mostra os dois e diz qual vale (14/out).
    const anoNac = a.anoNacional != null && a.anoNacional !== '' ? parseInt(String(a.anoNacional), 10) : NaN
    const divergente = Number.isFinite(anoNac) && anoNac !== Number(anoEst)
      ? `A base nacional mostra ${anoNac}; vale o DETRAN${uf ? '-' + uf : ''}, que é o registro do estado.`
      : null
    const juntar = (n: string | null) => [n, divergente].filter(Boolean).join(' ') || null
    // Licenciado no exercicio atual (ou adiante) nao e atraso, mesmo com o
    // parser marcando atraso. Caso EMZ4D53 (16/out): DETRAN-SP com ultimo
    // licenciamento 2026 e "atrasado" 2026 (taxa do exercicio na lista de
    // debitos); o carro esta licenciado em 2026, entao a faixa diz Em dia.
    const ultimo = e.ultimo_licenciamento_ano != null ? Number(e.ultimo_licenciamento_ano) : null
    const licenciadoNoExercicio = ultimo != null && Number.isFinite(ultimo) && ultimo >= atual
    const atrasoReal = e.licenciamento_atrasado_ano != null && !licenciadoNoExercicio
    if (atrasoReal) {
      return { ano: String(anoEst), tom: 'alerta', rotulo: 'Atrasado', fonte, licenciadoEm, emissao: null, nota: divergente }
    }
    const t = tomDoAno(Number(anoEst), atual)
    return { ano: String(anoEst), tom: t.tom, rotulo: t.rotulo, nota: juntar(t.nota), fonte, licenciadoEm, emissao: null }
  }
  if (a.anoNacional == null || a.anoNacional === '') return null
  const ano = parseInt(String(a.anoNacional), 10)
  if (!Number.isFinite(ano)) return null
  const t = tomDoAno(ano, atual)
  return {
    ano: String(a.anoNacional), tom: t.tom, rotulo: t.rotulo, fonte: null, licenciadoEm: null,
    emissao: a.emissaoNacional ?? null,
    nota: t.nota ? `${t.nota} Ano ${NOTA_BASE_NACIONAL}.` : `Ano ${NOTA_BASE_NACIONAL}.`,
  }
}
