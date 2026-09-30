// Registro de NOTIFICACAO para leilao (edital de notificacao do DETRAN).
//
// O DETRAN publica o aviso ao proprietario de que o veiculo vai a leilao. Isso
// NAO prova que o leilao aconteceu: o dono pode ter retirado o veiculo antes.
// Na base de leiloes essas linhas vem com situacao='notificado' e
// detalhes.tipo_registro='notificacao_leilao', e o matcher da leiloes-api
// ganhou o nivel de gravidade 'notificado' (cinza).
//
// A deteccao mora aqui, e nao so no matcher, por dois motivos: (1) a versao da
// API em producao ainda devolve essas linhas como "Leilao de patio (DETRAN)"
// em amarelo, e (2) o snapshot do relatorio e imutavel, entao um relatorio
// comprado antes do nivel novo guarda a gravidade antiga pra sempre. Olhando a
// situacao/tipo_registro, a tela acerta nos dois casos.

export const TIPO_REGISTRO_NOTIFICACAO = 'notificacao_leilao'

export const GRAVIDADE_NOTIFICADO = {
  nivel: 'notificado',
  cor: 'cinza',
  rotulo: 'Notificado para leilão (DETRAN)',
  motivo: 'O veículo constou em edital de notificação; o proprietário pode ter retirado antes do leilão.',
} as const

export const EXPLICA_NOTIFICACAO =
  'O veículo constou em edital de notificação; o proprietário pode ter retirado antes do leilão.'

/** A passagem e um edital de notificacao, nao um leilao realizado? */
export function ehNotificacao(p: any): boolean {
  if (!p || typeof p !== 'object') return false
  if (String(p.situacao || '').toLowerCase() === 'notificado') return true
  const det = p.detalhes
  if (det && typeof det === 'object' && det.tipo_registro === TIPO_REGISTRO_NOTIFICACAO) return true
  return p.gravidade?.nivel === 'notificado'
}

function dataBR(iso: unknown): string | null {
  const s = String(iso || '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/**
 * "Notificado para leilão pelo DETRAN-RJ (leilão previsto para 09/06/2010)".
 * A data do indice nem sempre e a da notificacao: no RJ as vezes e a do D.O.,
 * as vezes a data marcada pro leilao, entao a frase fala em leilao PREVISTO,
 * que e verdade nos dois casos (decisao do Cesar, 30/set). Sem UF, cai no
 * nome generico; sem data, a frase termina no orgao (um terco das linhas do RJ
 * nao tem data, e inventar uma seria pior que omitir).
 */
export function tituloNotificacao(p: any): string {
  const uf = String(p?.fonte_uf || '').trim().toUpperCase()
  const orgao = /^[A-Z]{2}$/.test(uf) ? `DETRAN-${uf}` : 'DETRAN'
  const data = dataBR(p?.data_leilao)
  return `Notificado para leilão pelo ${orgao}${data ? ` (leilão previsto para ${data})` : ''}`
}

/**
 * Contagem por nivel de confianca SEM as notificacoes. A API soma notificacao
 * em n_confirmado (ela casa pelo chassi inteiro, entao e "confirmado" que o
 * registro e deste carro), mas pro relatorio "confirmado" quer dizer leilao,
 * e notificacao nao e leilao.
 */
export function contarPassagens(passagens: any[] | null | undefined) {
  const c = { confirmado: 0, provavel: 0, possivel: 0, notificado: 0 }
  for (const p of Array.isArray(passagens) ? passagens : []) {
    if (ehNotificacao(p)) {
      // Notificacao so conta com identificacao forte. Um "possivel" por final
      // de placa num edital de notificacao nao diz nada sobre este carro.
      if (p.nivel === 'confirmado' || p.nivel === 'provavel') c.notificado += 1
      continue
    }
    if (p?.nivel === 'confirmado') c.confirmado += 1
    else if (p?.nivel === 'provavel') c.provavel += 1
    else if (p?.nivel === 'possivel') c.possivel += 1
  }
  return c
}
