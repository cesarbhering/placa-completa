import { ambienteForaDeProd } from './ambiente-alerta'
import { horaBrasilia } from './sendErrorEmail'

// E-mail ao Cesar quando a chamada ao juiz Haiku da FIPE falha (pedido de
// 10/out, depois do HSX1F20, que caiu no fallback sem deixar rastro).
//
// Sai do mesmo ponto do log [fipe-haiku]. Conteudo: motivo, modelo, horario e
// token do pedido. Sem placa, chassi ou e-mail do cliente.
//
// Anti-spam: no maximo 1 e-mail por motivo a cada 60 min. O que acontecer
// dentro da janela e so contado e vai agregado no proximo e-mail daquele
// motivo. A janela vive na memoria do processo (mesmo criterio do
// alerta-abuso): um restart zera, no pior caso sai um e-mail a mais.
//
// Fail-open e fora do caminho: quem chama dispara sem await.

export const DESTINO_ALERTA_HAIKU = 'cesarcbhering@gmail.com'
const REMETENTE = 'PlacaCompleta Errors <erros@placacompleta.com.br>'
export const JANELA_ALERTA_HAIKU_MS = 60 * 60 * 1000

export interface FalhaHaiku {
  /** Chave do anti-spam e titulo: "HTTP 400 invalid_request_error", "timeout 5000 ms", "sem bloco text", "JSON invalido", "erro de rede". */
  motivo: string
  /** Detalhe curto (mensagem de erro da API, stop_reason). Nunca dado do veiculo. */
  detalhe?: string | null
  modelo: string
  token?: string | null
}

interface EstadoMotivo { ultimoEnvio: number; acumuladas: number; tokens: string[] }
const estado = new Map<string, EstadoMotivo>()

/** So pros testes. */
export function _zerarAlertaHaiku() { estado.clear() }

export function montarAlertaHaiku(f: FalhaHaiku, ocorrencias: number, tokensJanela: string[], agora: Date): { subject: string; text: string } {
  const subject = `[FIPE] Haiku falhou: ${f.motivo}${ocorrencias > 1 ? ` (${ocorrencias}x)` : ''}`
  const text = [
    'A chamada ao Haiku na escolha da versao FIPE falhou.',
    'O relatorio seguiu sem o juiz: mostra a lista de versoes ou o melhor candidato da fonte.',
    '',
    `Motivo: ${f.motivo}`,
    ...(f.detalhe ? [`Detalhe: ${String(f.detalhe).slice(0, 300)}`] : []),
    `Modelo: ${f.modelo}`,
    `Horario: ${horaBrasilia(agora)}`,
    `Pedido (token): ${f.token || '(sem token)'}`,
    '',
    ocorrencias > 1
      ? `Ocorrencias deste motivo desde o ultimo aviso: ${ocorrencias} (incluindo esta). Tokens: ${tokensJanela.join(', ') || '-'}`
      : 'Primeira ocorrencia deste motivo na ultima hora.',
    '',
    '(No maximo 1 e-mail por motivo a cada 60 min; as ocorrencias no meio sao somadas no proximo.)',
  ].join('\n')
  return { subject, text }
}

/**
 * Registra a falha e envia se a janela do motivo permitir. Devolve true se
 * enviou. Nunca lanca.
 */
export async function alertarFalhaHaiku(
  f: FalhaHaiku,
  deps: { config?: any; agora?: () => number; enviar?: (msg: { from: string; to: string[]; subject: string; text: string }) => Promise<void> } = {},
): Promise<boolean> {
  try {
    const config = deps.config ?? useRuntimeConfig()
    // Homolog/staging nao manda: teste nao e incidente de cliente.
    if (ambienteForaDeProd(config)) return false
    if (!deps.enviar && !config.resendApiKey) return false

    const agora = (deps.agora ?? Date.now)()
    const e = estado.get(f.motivo) ?? { ultimoEnvio: 0, acumuladas: 0, tokens: [] }
    e.acumuladas++
    if (f.token && e.tokens.length < 20) e.tokens.push(f.token)
    estado.set(f.motivo, e)
    if (e.ultimoEnvio && agora - e.ultimoEnvio < JANELA_ALERTA_HAIKU_MS) return false

    const ocorrencias = e.acumuladas
    const tokens = e.tokens
    // Zera antes do envio: duas falhas simultaneas nao mandam 2 e-mails.
    e.ultimoEnvio = agora; e.acumuladas = 0; e.tokens = []

    const { subject, text } = montarAlertaHaiku(f, ocorrencias, tokens, new Date(agora))
    const msg = { from: REMETENTE, to: [DESTINO_ALERTA_HAIKU], subject, text }
    try {
      if (deps.enviar) await deps.enviar(msg)
      else {
        await $fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
          body: msg,
          timeout: 10000,
        })
      }
      return true
    } catch (err: any) {
      // Envio falhou: devolve as ocorrencias pra janela e libera o proximo.
      e.ultimoEnvio = 0; e.acumuladas += ocorrencias; e.tokens = [...tokens, ...e.tokens].slice(0, 20)
      console.warn('[fipe-haiku] e-mail de alerta falhou:', err?.message || err)
      return false
    }
  } catch (err: any) {
    console.warn('[fipe-haiku] alerta falhou:', err?.message || err)
    return false
  }
}
