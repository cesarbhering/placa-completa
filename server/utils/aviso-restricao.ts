import { chavesSemCopy } from '../../shared/restricoes'
import { normalizarResposta } from '../../shared/planos'
import { ambienteForaDeProd } from './ambiente-alerta'
import { emVoo } from './tarefas-em-voo'

// Restricao sem copy propria (14/out): quando um relatorio entregue tem um
// codigo de restricao que cai no texto generico do relatorio, avisa por e-mail
// pra ampliarmos o dicionario (shared/restricoes.ts). Caso CYU7D91:
// ALTERACAO_DOC aparecia como "Restrição Alteracao doc" + texto generico, e
// ficamos sabendo pelo Cesar.
//
// 1 e-mail por chave por dia (memoria do processo: um restart no mesmo dia pode
// repetir 1 vez). So prod. Sem dado pessoal: a chave, a placa e o token.

export const DESTINO_AVISO_RESTRICAO = 'helena@placacompleta.com.br'
const REMETENTE = 'Helena PlacaCompleta <helena@placacompleta.com.br>'

const avisadas = new Map<string, string>() // chave -> dia (YYYY-MM-DD, BRT) do ultimo aviso

function diaBrt(agora: number): string {
  return new Date(agora).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Chaves novas hoje (marca como avisadas). Pura, pra teste. */
export function chavesParaAvisar(chaves: string[], agora = Date.now()): string[] {
  const hoje = diaBrt(agora)
  const novas = chaves.filter((c) => avisadas.get(c) !== hoje)
  for (const c of novas) avisadas.set(c, hoje)
  return novas
}

export function montarAvisoRestricao(chaves: string[], placa: string, token: string | null): { subject: string; text: string } {
  return {
    subject: `Restrição sem copy própria: ${chaves.join(', ')} (${placa})`,
    text: [
      'Um relatório entregue mostrou restrição com o texto genérico, sem explicação própria.',
      '',
      `Código(s): ${chaves.join(', ')}`,
      `Placa: ${placa}`,
      token ? `Relatório: https://placacompleta.com.br/premium/${token}` : '',
      '',
      'Incluir rótulo e explicação em shared/restricoes.ts (EXPLICA_RESTRICAO / ROTULO_RESTRICAO, ou ITENS_INFORMATIVOS se não restringe).',
      'Aviso único por código por dia.',
    ].filter((l) => l !== null).join('\n'),
  }
}

/**
 * Ve se a resposta do relatorio tem restricao sem copy e, se tiver chave nova
 * hoje, manda o e-mail. Fire-and-forget (em voo). Nunca lanca.
 */
export function avisarRestricaoSemCopy(
  response: any,
  pedido: { placa: string; token_entrega?: string | null },
  deps: { config?: any; agora?: number; enviar?: (msg: { from: string; to: string[]; subject: string; text: string }) => Promise<void> } = {},
): Promise<boolean> {
  try {
    const chaves = chavesSemCopy(normalizarResposta(response)?.restricoesItens)
    if (!chaves.length) return Promise.resolve(false)
    const config = deps.config ?? useRuntimeConfig()
    if (ambienteForaDeProd(config)) return Promise.resolve(false)
    if (!deps.enviar && !config.resendApiKey) return Promise.resolve(false)
    const novas = chavesParaAvisar(chaves, deps.agora)
    if (!novas.length) return Promise.resolve(false)
    const { subject, text } = montarAvisoRestricao(novas, pedido.placa, pedido.token_entrega ?? null)
    const msg = { from: REMETENTE, to: [DESTINO_AVISO_RESTRICAO], subject, text }
    return emVoo('aviso-restricao', async () => {
      try {
        if (deps.enviar) await deps.enviar(msg)
        else await $fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' }, body: msg, timeout: 10000 })
        return true
      } catch (e: any) {
        // Libera pra tentar de novo no proximo acesso.
        for (const c of novas) avisadas.delete(c)
        console.warn('[aviso-restricao] e-mail falhou:', e?.message || e)
        return false
      }
    }).then((r) => !!r)
  } catch {
    return Promise.resolve(false)
  }
}

/** So pra testes. */
export function _resetarAvisoRestricao(): void { avisadas.clear() }
