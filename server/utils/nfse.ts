import { provedorNfse, descricaoDaNota, ErroNfseIndisponivel, ErroNfseRejeitado, type NfseProvedor, type NfseNota } from './nfse-provedor'
import { lerTomador as lerTomadorPadrao } from './tomador'
import { sendErrorEmail } from './sendErrorEmail'
import { enviarNfseEmail } from './premium-email'

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

// ---------- Webhook: apply the emitter's state to the order ----------

const ESTADOS_NFSE = new Set(['emitida', 'rejeitada', 'falhou', 'cancelada', 'cancelamento_rejeitado', 'nao_emitir', 'sem_tomador'])

interface DepsEstado {
  provedor?: Pick<NfseProvedor, 'pdf'>
  enviarEmail?: typeof enviarNfseEmail
  agora?: () => Date
  config?: any
}

/** Applies a webhook note to the order and sends the invoice e-mail once. Idempotent. */
export async function aplicarEstadoNfse(supabase: any, pedido: any, nota: NfseNota, deps: DepsEstado = {}): Promise<void> {
  const agora = (deps.agora ?? (() => new Date()))().toISOString()
  // pendente/cancelando (and anything unknown) keep the order as enfileirada.
  const status = ESTADOS_NFSE.has(nota.estado) ? nota.estado : 'enfileirada'
  const atual = pedido.nfse_status ?? null
  // Out-of-order or retried deliveries must never roll the state back.
  if (status === 'enfileirada' && atual !== null && !['a_enfileirar', 'enfileirada'].includes(atual)) return
  if (status === 'emitida' && ['cancelada', 'cancelamento_rejeitado'].includes(atual)) return

  const patch: Record<string, unknown> = {
    nfse_status: status,
    nfse_erro: nota.erro?.codigo ?? null,
    nfse_atualizado_em: agora,
  }
  // Only fields that are present are copied; a delivery never nulls an existing value.
  const campos: Array<[string, unknown]> = [
    ['nfse_numero', nota.numero], ['nfse_serie', nota.serie], ['nfse_chave', nota.chave_acesso],
    ['nfse_emitida_em', nota.emitida_em], ['nfse_cancelada_em', nota.cancelada_em],
  ]
  for (const [k, v] of campos) if (v !== undefined && v !== null) patch[k] = v
  if (!pedido.nfse_id && nota.id) patch.nfse_id = nota.id
  let q = supabase.from('pedidos_premium').update(patch).eq('id', pedido.id)
  // Race-safe: a concurrent cancellation wins over a late emitida.
  if (status === 'emitida') q = q.not('nfse_status', 'in', '(cancelada,cancelamento_rejeitado)').select('id')
  const r = await q
  if (r?.error) throw new Error('nfse: status write failed')
  if (status === 'emitida' && (!Array.isArray(r?.data) || r.data.length === 0)) return

  if (status !== 'emitida' || !pedido.email || pedido.nfse_email_em) return

  let pdf: Buffer
  try {
    pdf = await (deps.provedor ?? provedorNfse()).pdf(nota.id)
  } catch (e: any) {
    // nfse_email_em stays null so the reconciliation job retries.
    console.warn(`[nfse] pdf fetch failed order=${String(pedido.id).slice(0, 8)}`, e?.name)
    return
  }

  // Lock: only the delivery that flips nfse_email_em from null sends the e-mail.
  const lock = await supabase.from('pedidos_premium').update({ nfse_email_em: agora }).eq('id', pedido.id).is('nfse_email_em', null).select('id')
  if (lock?.error || !Array.isArray(lock?.data) || lock.data.length === 0) return

  let ok = false
  try {
    ok = await (deps.enviarEmail ?? enviarNfseEmail)(
      { email: pedido.email, token: pedido.token_entrega, placa: pedido.placa, numero: String(nota.numero ?? ''), pdf },
      deps.config ? { config: deps.config } : {},
    )
  } catch { ok = false }
  if (!ok) {
    const reset = await supabase.from('pedidos_premium').update({ nfse_email_em: null }).eq('id', pedido.id)
    if (reset?.error) console.warn(`[nfse] lock de e-mail nao foi desfeito pedido=${String(pedido.id).slice(0, 8)}`)
  }
}
