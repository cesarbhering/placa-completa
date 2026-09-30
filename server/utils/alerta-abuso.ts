// Aviso ao time quando alguem bate no teto por IP.
//
// O bloqueio ja acontecia e ja era registrado em blocked_requests, mas nada
// avisava ninguem: o abuso de 386 placas pelo app so apareceu quando alguem
// foi olhar a tabela. Um e-mail no momento do bloqueio transforma isso em algo
// que a gente descobre na hora.
//
// Dedupe de uma hora por IP, senao um bot em loop vira centenas de e-mails e o
// alerta perde o efeito. O dedupe vive na memoria do processo: um restart do
// container zera a janela, o que no pior caso manda um e-mail a mais. Preferi
// isso a criar tabela nova pra uma feature de aviso.
//
// Nada alem de IP, e-mail e user agent do abusador sai daqui.

const ultimoAviso = new Map<string, number>()
// Com o teto gratis em 5/h (30/set), cliente legitimo bate no limite com
// frequencia; abuso e continuar batendo DEPOIS do bloqueio. So avisa a partir
// do 3o bloqueio do IP na hora (sem contagem disponivel, avisa como antes).
export const BLOQUEIOS_PRA_AVISAR = 3
const UMA_HORA_MS = 60 * 60 * 1000

/** Limpa chaves velhas pra memoria nao crescer sem limite num processo longo. */
function podarAntigos(agora: number) {
  if (ultimoAviso.size < 500) return
  for (const [chave, quando] of ultimoAviso) {
    if (agora - quando > UMA_HORA_MS) ultimoAviso.delete(chave)
  }
}

export interface AvisoAbuso {
  ip: string
  rota: string
  teto: number
  email?: string | null
  userAgent?: string | null
  /** Quantos bloqueios este IP ja levou na ultima hora, quando der pra contar. */
  bloqueiosNaHora?: number | null
}

/**
 * Manda UM e-mail por IP por hora. Fail-open: qualquer erro aqui e engolido,
 * porque um aviso que falha nunca pode interferir na resposta ao usuario.
 */
export async function avisarAbuso(dados: AvisoAbuso): Promise<void> {
  try {
    if (dados.bloqueiosNaHora != null && dados.bloqueiosNaHora < BLOQUEIOS_PRA_AVISAR) return
    const agora = Date.now()
    const anterior = ultimoAviso.get(dados.ip)
    if (anterior && agora - anterior < UMA_HORA_MS) return
    ultimoAviso.set(dados.ip, agora)
    podarAntigos(agora)

    await sendErrorEmail({
      endpoint: `abuso: teto por IP em ${dados.rota}`,
      errorMessage: [
        `IP ${dados.ip} bateu o teto de ${dados.teto} consultas por hora.`,
        dados.email ? `E-mail informado: ${dados.email}` : 'Sem e-mail informado.',
        dados.bloqueiosNaHora != null ? `Bloqueios deste IP na ultima hora: ${dados.bloqueiosNaHora}.` : '',
        'Proximo aviso deste mesmo IP so daqui a uma hora.',
      ].filter(Boolean).join('\n'),
      userAgent: dados.userAgent || undefined,
      ip: dados.ip,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    console.warn('[alerta-abuso] falhou (sem efeito na resposta):', e?.message)
  }
}

/** Quantos bloqueios este IP levou na ultima hora. Melhor esforco. */
export async function contarBloqueiosNaHora(supabase: any, ip: string): Promise<number | null> {
  try {
    const umaHoraAtras = new Date(Date.now() - UMA_HORA_MS).toISOString()
    const { count } = await supabase
      .from('blocked_requests')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gte('created_at', umaHoraAtras)
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}
