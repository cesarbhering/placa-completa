import { sendErrorEmail } from './sendErrorEmail'

// Tells the team when a signed payment event names an order of ours while the
// charge it is about is not a charge of ours for that order. A genuine event
// never ends up here, so each case deserves a look.
//
// One e-mail per correlationID per hour. The window lives in the memory of the
// process, like the one of alerta-abuso.ts: a restart sends one e-mail more at
// worst.
//
// Nothing about the payer leaves here: only the event type, the correlationID,
// the order and the reason. The event type and the correlationID come from the
// event, so they are reduced to plain characters and cut before they are
// written into the e-mail.

const UMA_HORA_MS = 60 * 60 * 1000
const ultimoAviso = new Map<string, number>()

const MOTIVOS = {
  nao_existe: 'a cobrança do evento não existe na nossa conta',
  outra_cobranca: 'a nossa conta tem outra cobrança com esse correlationID, não a do evento',
  de_outro_pedido: 'o provedor liga essa cobrança a outro pedido',
  sem_correlacao_do_pedido: 'o correlationID do evento não é deste pedido',
} as const

export interface EventoEstranhoWoovi {
  evento: string
  correlationID: string
  pedidoId: string
  motivo: keyof typeof MOTIVOS
}

/** Keeps letters, digits and the punctuation our own ids use; cuts the rest. */
const limpo = (valor: unknown, tamanho: number) => String(valor ?? '').replace(/[^A-Za-z0-9:_.-]/g, '?').slice(0, tamanho) || '-'

/** Drops old keys so the map does not grow in a long-lived process. */
function podar(agora: number) {
  if (ultimoAviso.size < 500) return
  for (const [chave, quando] of ultimoAviso) {
    if (agora - quando >= UMA_HORA_MS) ultimoAviso.delete(chave)
  }
}

/**
 * Sends ONE e-mail per correlationID per hour. Returns whether it was sent.
 * Never throws: an alert that fails must not change the answer to the provider.
 */
export async function avisarEventoEstranhoWoovi(dados: EventoEstranhoWoovi, agora = Date.now()): Promise<boolean> {
  const correlationID = limpo(dados.correlationID, 120)
  const pedidoId = limpo(dados.pedidoId, 60)
  const chave = `${correlationID}|${pedidoId}`
  try {
    const anterior = ultimoAviso.get(chave)
    if (anterior !== undefined && agora - anterior < UMA_HORA_MS) return false
    ultimoAviso.set(chave, agora)
    podar(agora)

    await sendErrorEmail({
      endpoint: 'webhook Woovi: evento de pagamento sem cobrança nossa',
      errorMessage: [
        'Chegou um evento de pagamento assinado pelo provedor que cita um pedido nosso, mas a cobrança do evento não é uma cobrança nossa desse pedido.',
        'Nada foi processado por causa dele.',
        `Evento: ${limpo(dados.evento, 60)}`,
        `correlationID do evento: ${correlationID}`,
        `Pedido: ${pedidoId}`,
        `Motivo: ${MOTIVOS[dados.motivo] || '-'}`,
        'Próximo aviso deste mesmo correlationID só daqui a uma hora.',
      ].join(' | '),
      timestamp: new Date(agora).toISOString(),
    })
    return true
  } catch (e: any) {
    // Not sent: the next event of the same correlationID tries again.
    ultimoAviso.delete(chave)
    console.warn('[woovi] alert about an unknown charge was not sent:', e?.name || 'error')
    return false
  }
}
