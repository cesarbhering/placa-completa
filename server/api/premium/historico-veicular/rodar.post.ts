import { assertAdminSecret } from '../../../utils/admin-secret'
import { completarHistoricoVeicular } from '../../../utils/parceiro-historico'
import { cfgHistorico } from '../../../utils/parceiro-historico-env'
import { fonteNoPlano } from '../../../../shared/planos'

// Operator-only (x-admin-secret; without it, 404): runs the vehicle history
// partner for ONE delivered Completa order, even with
// NUXT_PARCEIRO_HISTORICO_LIGADO off, to test the source before turning it on.
// Needs NUXT_PARCEIRO_HISTORICO_KEY. Same path as the delivery: valid cache
// neither calls nor pays, one charge per order, daily ceiling. No e-mail to
// the customer. The answer carries counts only, never personal data.
//   POST { "token": "<token_entrega>" }  or  { "pedido_id": "<uuid>" }
export default defineEventHandler(async (event) => {
  assertAdminSecret(event)

  const body: any = await readBody(event).catch(() => ({}))
  const token = String(body?.token || '').trim()
  const pedidoId = String(body?.pedido_id || '').trim()
  if (!token && !pedidoId) throw createError({ statusCode: 400, message: 'token ou pedido_id obrigatorio' })
  const supabase = usePremiumSupabase()
  let q = supabase.from('pedidos_premium').select('id,placa,plano,status')
  q = token ? q.eq('token_entrega', token) : q.eq('id', pedidoId)
  const { data: p } = await q.maybeSingle()
  if (!p) throw createError({ statusCode: 404, message: 'pedido nao encontrado' })
  if (p.status !== 'entregue') throw createError({ statusCode: 409, message: 'pedido nao entregue' })
  if (!fonteNoPlano('historico_veicular', p.plano)) throw createError({ statusCode: 409, message: 'so no plano completa' })
  const cfg = cfgHistorico(useRuntimeConfig())
  if (!cfg.chave) throw createError({ statusCode: 503, message: 'sem a chave da fonte' })

  const r = await completarHistoricoVeicular(supabase, { id: p.id, placa: p.placa, plano: p.plano }, { cfg, ignorarChave: true })
  const b = r.bloco
  return {
    ok: r.ok,
    status: r.status ?? null,
    pulado: r.pulado ?? null,
    cacheHit: !!r.cacheHit,
    cobrada: !!r.cobrada,
    custoCentavos: r.custoCentavos ?? 0,
    code: r.code ?? null,
    erro: r.erro ?? null,
    tempoMs: r.tempoMs ?? null,
    resumo: b?.status === 'ok'
      ? {
          donos: b.donos?.total ?? 0,
          parecerSeguro: b.sinistro?.parecer ?? null,
          registrosLeilao: b.leilao?.registros?.length ?? 0,
          indicioSinistro: !!b.leilao?.indicioSinistro,
        }
      : null,
  }
})
