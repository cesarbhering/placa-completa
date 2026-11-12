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

  if (status !== 'emitida') return
  await enviarEmailNfseSeDevido(supabase, pedido, nota.id, nota.numero, { ...deps, agora: () => new Date(agora) })
}

export type ResultadoEmailNfse = 'enviado' | 'pulado' | 'falhou' | 'indisponivel'

/** Sends the invoice e-mail once (lock on nfse_email_em). Never throws. */
export async function enviarEmailNfseSeDevido(
  supabase: any, pedido: any, notaId: string, numero: unknown,
  deps: Pick<DepsEstado, 'provedor' | 'enviarEmail' | 'agora' | 'config'> = {},
): Promise<ResultadoEmailNfse> {
  if (!pedido.email || pedido.nfse_email_em) return 'pulado'
  const agora = (deps.agora ?? (() => new Date()))().toISOString()

  let pdf: Buffer
  try {
    pdf = await (deps.provedor ?? provedorNfse()).pdf(notaId)
  } catch (e: any) {
    // nfse_email_em stays null so the reconciliation job retries.
    console.warn(`[nfse] pdf fetch failed order=${String(pedido.id).slice(0, 8)}`, e?.name)
    return e instanceof ErroNfseIndisponivel ? 'indisponivel' : 'falhou'
  }

  // Lock: only the delivery that flips nfse_email_em from null sends the e-mail.
  const lock = await supabase.from('pedidos_premium').update({ nfse_email_em: agora }).eq('id', pedido.id).is('nfse_email_em', null).select('id')
  if (lock?.error || !Array.isArray(lock?.data) || lock.data.length === 0) return 'pulado'

  let ok = false
  try {
    ok = await (deps.enviarEmail ?? enviarNfseEmail)(
      { email: pedido.email, token: pedido.token_entrega, placa: pedido.placa, numero: String(numero ?? ''), pdf },
      deps.config ? { config: deps.config } : {},
    )
  } catch { ok = false }
  if (ok) return 'enviado'
  const reset = await supabase.from('pedidos_premium').update({ nfse_email_em: null }).eq('id', pedido.id)
  if (reset?.error) console.warn(`[nfse] email lock was not released order=${String(pedido.id).slice(0, 8)}`)
  return 'falhou'
}

// ---------- Cancel on refund ----------

interface DepsCancelar {
  provedor?: Pick<NfseProvedor, 'cancelar'>
  config?: { nfse?: string }
}

export type ResultadoCancelar = 'cancelando' | 'nao_emitir' | 'pendente' | 'rejeitado' | 'ignorado'

/** Cancels (or blocks) the invoice of a refunded order. Never throws. */
export async function cancelarNfse(
  supabase: any, pedidoId: string, motivo = 'Estorno do pagamento ao cliente', deps: DepsCancelar = {},
): Promise<ResultadoCancelar> {
  try {
    if ((deps.config ?? (useRuntimeConfig() as any)).nfse !== 'on') return 'ignorado'
    const { data: p, error } = await supabase.from('pedidos_premium').select('nfse_id, nfse_status, nfse_erro').eq('id', pedidoId).single()
    if (error || !p) return 'ignorado'
    const curto = String(pedidoId).slice(0, 8)

    if (!p.nfse_id) {
      if (p.nfse_status == null || ['a_enfileirar', 'sem_tomador'].includes(p.nfse_status)) {
        // Conditional write: a note issued meanwhile (status moved on) must not be hidden.
        await supabase.from('pedidos_premium')
          .update({ nfse_status: 'nao_emitir', nfse_atualizado_em: new Date().toISOString() })
          .eq('id', pedidoId).is('nfse_id', null)
          .or('nfse_status.is.null,nfse_status.eq.a_enfileirar,nfse_status.eq.sem_tomador')
        return 'nao_emitir'
      }
      return 'ignorado'
    }
    if (p.nfse_status === 'cancelada') return 'ignorado'

    try {
      await (deps.provedor ?? provedorNfse()).cancelar(p.nfse_id, motivo)
      // The status changes only when the nota.cancelada webhook arrives.
      if (p.nfse_erro) await supabase.from('pedidos_premium').update({ nfse_erro: null }).eq('id', pedidoId)
      return 'cancelando'
    } catch (e: any) {
      if (e instanceof ErroNfseRejeitado) {
        if (e.status === 409) {
          console.warn(`[nfse] cancel: note already in a final state order=${curto}`)
          // Stop the reconciliation retry loop; nothing else changes.
          if (p.nfse_erro === 'cancelar_pendente') await supabase.from('pedidos_premium').update({ nfse_erro: null }).eq('id', pedidoId)
          return 'ignorado'
        }
        await supabase.from('pedidos_premium').update({ nfse_erro: `cancelar_rejeitado:${e.status}` }).eq('id', pedidoId)
        return 'rejeitado'
      }
      await supabase.from('pedidos_premium').update({ nfse_erro: 'cancelar_pendente' }).eq('id', pedidoId)
      return 'pendente'
    }
  } catch (e: any) {
    console.warn(`[nfse] cancel failed order=${String(pedidoId).slice(0, 8)}`, e?.name)
    return 'ignorado'
  }
}

// ---------- Reconciliation ----------

interface DepsReconciliar extends Deps, DepsCancelar {
  provedor?: Pick<NfseProvedor, 'emitir' | 'consultar' | 'pdf' | 'cancelar'>
  enviarEmail?: typeof enviarNfseEmail
}

const LOTE = 50
const OBSOLETA_MIN = 15
const COLUNAS_RECONCILIAR = 'id, token_entrega, placa, email, nfse_id, nfse_status, nfse_erro, nfse_numero, nfse_email_em'

/** Retries what the delivery path and the webhook may have left behind. Sequential, never throws. */
export async function reconciliarNfse(supabase: any, deps: DepsReconciliar = {}) {
  const out = { enfileiradas: 0, atualizadas: 0, emails: 0, cancelamentos: 0 }
  try {
    const config = deps.config ?? (useRuntimeConfig() as any)
    if (config.nfse !== 'on') return out
    const agora = (deps.agora ?? (() => new Date()))()
    const corte = new Date(agora.getTime() - OBSOLETA_MIN * 60_000).toISOString()
    const provedor = deps.provedor ?? provedorNfse()
    const aviso = (etapa: string, id: unknown, e: any) => console.warn(`[nfse] reconcile ${etapa} failed order=${String(id).slice(0, 8)}`, e?.name)
    const ler = async (q: any): Promise<any[]> => {
      const r = await q
      return !r?.error && Array.isArray(r?.data) ? r.data : []
    }
    const tabela = () => supabase.from('pedidos_premium')

    // (a) orders the delivery path could not enqueue
    for (const p of await ler(tabela().select('id').eq('nfse_status', 'a_enfileirar').order('nfse_atualizado_em', { ascending: true, nullsFirst: true }).limit(LOTE))) {
      await enfileirarNfse(supabase, p.id, { ...deps, provedor })
      out.enfileiradas++
    }

    // (b) enqueued notes the webhook never confirmed
    for (const p of await ler(tabela().select(COLUNAS_RECONCILIAR).eq('nfse_status', 'enfileirada').not('nfse_id', 'is', null).lt('nfse_atualizado_em', corte).order('nfse_atualizado_em', { ascending: true }).limit(LOTE))) {
      try {
        const nota = await provedor.consultar(p.nfse_id)
        await aplicarEstadoNfse(supabase, p, nota, { provedor, enviarEmail: deps.enviarEmail, agora: () => agora, config: deps.config })
        out.atualizadas++
      } catch (e: any) {
        aviso('consult', p.id, e)
        if (e instanceof ErroNfseIndisponivel) return out
      }
    }

    // (c) issued notes whose e-mail was never sent
    for (const p of await ler(tabela().select(COLUNAS_RECONCILIAR).eq('nfse_status', 'emitida').not('email', 'is', null).is('nfse_email_em', null).not('nfse_id', 'is', null).order('nfse_atualizado_em', { ascending: true }).limit(LOTE))) {
      try {
        const r = await enviarEmailNfseSeDevido(supabase, p, p.nfse_id, p.nfse_numero, { provedor, enviarEmail: deps.enviarEmail, agora: () => agora, config: deps.config })
        if (r === 'enviado') out.emails++
        if (r === 'indisponivel') return out
      } catch (e: any) { aviso('email', p.id, e) }
    }

    // (d) cancellations the emitter could not take
    for (const p of await ler(tabela().select('id').eq('nfse_erro', 'cancelar_pendente').limit(LOTE))) {
      const r = await cancelarNfse(supabase, p.id, undefined, { provedor, config })
      out.cancelamentos++
      if (r === 'pendente') return out
    }
  } catch (e: any) {
    console.warn('[nfse] reconcile failed', e?.name)
  }
  return out
}
