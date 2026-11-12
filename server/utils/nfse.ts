import { provedorNfse, descricaoDaNota, ErroNfseIndisponivel, ErroNfseRejeitado, type NfseProvedor } from './nfse-provedor'
import { lerTomador as lerTomadorPadrao } from './tomador'
import { sendErrorEmail } from './sendErrorEmail'

// Orquestrador da NFS-e depois da entrega. Regra de ouro: nada aqui atrasa nem
// quebra a venda. Quem chama usa `void emVoo(...)`; esta funcao nunca lanca.
// Nao loga documento, nome, e-mail nem corpo do emissor.

interface Deps {
  provedor?: Pick<NfseProvedor, 'emitir'>
  lerTomador?: (supabase: any, pedidoId: string) => Promise<{ documento: string; nome: string | null } | null>
  agora?: () => Date
  config?: { nfse?: string; nfseDesde?: string }
  avisar?: (pedidoId: string) => Promise<void>
}

const COLUNAS = 'id, token_entrega, placa, plano, valor_centavos, pago_em, entregue_em, email, pix_provider, canal, abacatepay_id, stripe_session_id, status, nfse_status, nfse_erro'

function dataSaoPaulo(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

async function avisarSemTomador(pedidoId: string): Promise<void> {
  await sendErrorEmail({
    endpoint: '/premium/nfse',
    errorMessage: `NFS-e sem dados do pagador. Pedido ${pedidoId}`,
  })
}

let avisouDesdeInvalido = false

export async function enfileirarNfse(supabase: any, pedidoId: string, deps: Deps = {}): Promise<void> {
  try {
    const config = deps.config ?? (useRuntimeConfig() as any)
    if (config.nfse !== 'on') return

    // Falha fechada: sem data de corte valida, nao emite nada (e nao toca no banco).
    const desde = config.nfseDesde ? new Date(config.nfseDesde).getTime() : NaN
    if (!Number.isFinite(desde)) {
      if (!avisouDesdeInvalido) {
        avisouDesdeInvalido = true
        console.warn('[nfse] NUXT_NFSE_DESDE invalido ou vazio; emissao desligada')
      }
      return
    }

    const { data: p, error } = await supabase.from('pedidos_premium').select(COLUNAS).eq('id', pedidoId).single()
    if (error || !p) return
    if (p.nfse_status && p.nfse_status !== 'a_enfileirar') return

    const agora = (deps.agora ?? (() => new Date()))().toISOString()
    const gravar = async (patch: Record<string, unknown>) => {
      // Escrita condicional: so vale se ninguem mudou o status desde a leitura
      // (ex.: reembolso marcando nao_emitir enquanto o emissor respondia).
      const r = await supabase.from('pedidos_premium').update({ ...patch, nfse_atualizado_em: agora }).eq('id', pedidoId)
        .or('nfse_status.is.null,nfse_status.eq.a_enfileirar').select('id')
      // So conta se alguma linha casou o filtro (0 linhas = estado mudou).
      return !r?.error && Array.isArray(r?.data) && r.data.length > 0
    }

    if (p.status === 'reembolsado') { await gravar({ nfse_status: 'nao_emitir' }); return }

    const foraDeEscopo =
      p.pix_provider === 'google_play' ||
      (p.canal === 'app' && !p.abacatepay_id && !p.stripe_session_id) ||
      (p.entregue_em && new Date(p.entregue_em).getTime() < desde)
    if (foraDeEscopo) { await gravar({ nfse_status: 'fora_escopo' }); return }

    if (!p.entregue_em) return

    const tomador = await (deps.lerTomador ?? lerTomadorPadrao)(supabase, pedidoId)
    if (!tomador || !tomador.nome) {
      // So importa se um reconciliador devolver a linha para a_enfileirar: evita avisar de novo.
      const jaAvisado = p.nfse_erro === 'sem_tomador_avisado'
      const ok = await gravar({ nfse_status: 'sem_tomador', nfse_erro: 'sem_tomador_avisado' })
      if (ok && !jaAvisado) await (deps.avisar ?? avisarSemTomador)(pedidoId)
      return
    }

    try {
      const r = await (deps.provedor ?? provedorNfse()).emitir({
        referencia: pedidoId,
        valorCentavos: p.valor_centavos,
        competencia: dataSaoPaulo(p.pago_em || p.entregue_em),
        descricao: descricaoDaNota({ plano: p.plano, placa: p.placa, pedidoId }),
        tomador: { documento: tomador.documento, nome: tomador.nome },
        email: p.email,
        metadados: { token: p.token_entrega, plano: p.plano, placa: p.placa },
      })
      if (r?.id) {
        // O id da nota nunca se perde: grava sem filtro, depois o status com filtro.
        await supabase.from('pedidos_premium').update({ nfse_id: r.id, nfse_atualizado_em: agora }).eq('id', pedidoId)
        const ok = await gravar({ nfse_status: 'enfileirada', nfse_erro: null })
        if (!ok) console.warn(`[nfse] estado mudou durante a emissao pedido=${String(pedidoId).slice(0, 8)}`)
      } else await gravar({ nfse_status: 'a_enfileirar' })
    } catch (e: any) {
      // So 400, 409 e 422 sao rejeicao definitiva; o resto tenta de novo depois.
      if (e instanceof ErroNfseRejeitado && [400, 409, 422].includes(e.status)) {
        const b = (e.body ?? {}) as any
        let code = `${e.status}:${typeof b.erro === 'string' ? b.erro.slice(0, 60) : ''}`
        // So nomes de campos, nunca valores.
        if (Array.isArray(b.campos) && b.campos.every((c: unknown) => typeof c === 'string')) code += `:${b.campos.join(',')}`
        await gravar({ nfse_status: 'rejeitada', nfse_erro: code.slice(0, 200) })
      } else {
        await gravar({ nfse_status: 'a_enfileirar' })
      }
    }
  } catch (e: any) {
    console.warn(`[nfse] enfileirar falhou pedido=${String(pedidoId).slice(0, 8)}`, e?.name)
  }
}
