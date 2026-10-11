import { repoSupabase } from './repo-supabase'
import { perguntarAoAgente } from './agente'
import { consultarPedidos } from './pedidos'
import { cfgEvolution, enviarTexto, bloquearNumero } from './evolution'
import type { Deps } from './fluxo'

// Deps reais do atendimento (Supabase, Haiku, Evolution, Resend). Ligado so
// com NUXT_SUPORTE_WHATSAPP=on e o segredo: homolog/staging ficam desligados.

export const DESTINO_N2 = 'cesarcbhering@gmail.com'
const REMETENTE = 'PlacaCompleta <contato@placacompleta.com.br>'

export function suporteLigado(config: any): boolean {
  return String(config.suporteWhatsapp || '') === 'on' && !!config.suporteSecret
}

export function depsReais(config: any, sb: any): Deps | null {
  const evo = cfgEvolution(config)
  if (!suporteLigado(config) || !evo) return null
  return {
    repo: repoSupabase(sb),
    segredo: String(config.suporteSecret),
    segredoPagador: String(config.pagadorHashSecret || ''),
    agente: async (hist, extra) => perguntarAoAgente(hist, String(config.anthropicApiKey || ''), { extra }),
    consultarPedidos: (c) => consultarPedidos(sb, c),
    enviar: (jid, texto) => enviarTexto(evo, jid, texto),
    bloquear: (jid) => bloquearNumero(evo, jid),
    email: async (assunto, texto) => {
      if (!config.resendApiKey) return
      await $fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: { from: REMETENTE, to: [DESTINO_N2], subject: assunto, text: texto },
        timeout: 10000,
      })
    },
  }
}
