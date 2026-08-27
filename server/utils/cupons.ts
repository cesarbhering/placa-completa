import { aplicarCupom, PLANOS, type PlanoId } from '../../shared/planos'

// Validacao + calculo de cupom (v1). A AbacatePay E A FONTE DA VERDADE do
// cupom (o Cesar cria/gerencia os cupons direto no dashboard dela) — nao
// validamos mais contra uma tabela nossa. GET /coupons/get?id=<codigo>: o
// `id` do cupom na API da AbacatePay E o proprio codigo (confirmado ao vivo:
// criar com code="HEMORROIDAS" -> id volta "HEMORROIDAS").
//
// O nosso checkout e Pix TRANSPARENTE: a AbacatePay nao aplica o cupom
// sozinha (isso so existe no checkout hosted dela). Entao o desconto e
// calculado aqui (aplicarCupom, com piso) e aplicado no amountCentavos do
// Pix — SEMPRE recalculado no checkout.post.ts, nunca confia no client.
//
// Limite de uso: o `maxRedeems`/`redeemsCount` da AbacatePay NAO reflete
// nosso fluxo (ela so incrementa redeemsCount quando o cupom e usado nos
// checkouts/subscriptions hosted dela, que a gente nao usa). Por isso o
// limite global e SEMPRE contado na nossa tabela `cupons_premium_usos` (que
// virou so um log, sem mais referencia a `cupons_premium`), usando o
// maxRedeems que a AbacatePay devolve como teto. Por-cliente: sem suporte
// nativo na AbacatePay, mantemos o teto de 1 uso por email/cupom aqui — ja
// era assim na v1 e segue como higiene anti-abuso razoavel.
//
// Falha SEMPRE fechada: qualquer motivo de recusa devolve ok:false com um
// motivo, nunca deixa passar por omissao.

const LIMITE_USO_POR_CLIENTE = 1

export interface CupomValidado {
  ok: boolean
  motivo?: string
  /** Id do cupom na AbacatePay — que E o codigo, guardado no log de uso. */
  cupomId?: string
  precoBrutoCentavos: number
  descontoCentavos: number
  precoLiquidoCentavos: number
}

interface AbacateCoupon {
  id: string
  status: 'ACTIVE' | 'DELETED' | 'DISABLED'
  discountKind: 'PERCENTAGE' | 'FIXED'
  discount: number
  maxRedeems: number
  redeemsCount: number
}

export async function validarCupom(
  supabase: ReturnType<typeof usePremiumSupabase>,
  codigoBruto: string,
  plano: PlanoId,
  email: string,
): Promise<CupomValidado> {
  const precoBrutoCentavos = plano === 'basica' || plano === 'completa' ? PLANOS[plano].valorCentavos : 0
  const semDesconto = { ok: false as const, precoBrutoCentavos, descontoCentavos: 0, precoLiquidoCentavos: precoBrutoCentavos }

  if (plano !== 'basica' && plano !== 'completa') {
    return { ...semDesconto, motivo: 'Plano invalido para cupom.' }
  }

  const codigo = codigoBruto.trim().toUpperCase().replace(/\s+/g, '')
  if (!codigo) return { ...semDesconto, motivo: 'Informe um cupom.' }

  const { base, key } = cfg()
  let cupom: AbacateCoupon | null = null
  try {
    const res = await $fetch<{ data: AbacateCoupon | null; success: boolean; error: string | null }>(
      `${base}/coupons/get`,
      { method: 'GET', headers: { Authorization: `Bearer ${key}` }, query: { id: codigo } },
    )
    cupom = res.data
  } catch (e: any) {
    // 404 e o caso normal de "cupom nao existe" — nao e erro de infra.
    if (e?.statusCode !== 404 && e?.response?.status !== 404) {
      console.warn('[cupom] getCoupon falhou:', e?.data?.error || e?.message)
    }
    return { ...semDesconto, motivo: 'Cupom nao encontrado.' }
  }
  if (!cupom) return { ...semDesconto, motivo: 'Cupom nao encontrado.' }
  if (cupom.status !== 'ACTIVE') return { ...semDesconto, motivo: 'Cupom inativo.' }

  // Limite global: usa maxRedeems da AbacatePay como teto, mas CONTA no nosso
  // log (redeemsCount dela nao reflete o Pix transparente).
  if (cupom.maxRedeems != null && cupom.maxRedeems !== -1) {
    const { count } = await supabase
      .from('cupons_premium_usos')
      .select('id', { count: 'exact', head: true })
      .eq('cupom_id', cupom.id)
    if ((count || 0) >= cupom.maxRedeems) {
      return { ...semDesconto, motivo: 'Cupom esgotado.' }
    }
  }

  // Limite por-cliente: 1 uso por email/cupom (sem suporte nativo na API).
  const { count: usoCliente } = await supabase
    .from('cupons_premium_usos')
    .select('id', { count: 'exact', head: true })
    .eq('cupom_id', cupom.id)
    .eq('email', email)
  if ((usoCliente || 0) >= LIMITE_USO_POR_CLIENTE) {
    return { ...semDesconto, motivo: 'Voce ja usou este cupom.' }
  }

  const { precoBrutoCentavos: bruto, descontoCentavos, precoLiquidoCentavos } = aplicarCupom(plano, {
    tipo: cupom.discountKind === 'PERCENTAGE' ? 'percentual' : 'fixo',
    valor: cupom.discount,
    planos: ['basica', 'completa'], // AbacatePay nao restringe cupom por plano; a gente nao restringe tambem
  })

  return {
    ok: true,
    cupomId: cupom.id,
    precoBrutoCentavos: bruto,
    descontoCentavos,
    precoLiquidoCentavos,
  }
}

// Registra o uso (chamado SO pelo checkout, apos criar o pedido). pedido_id e
// UNIQUE na tabela: se o checkout for chamado 2x pro mesmo pedido (retry),
// o segundo insert falha e e ignorado — sem double-count no P&L. cupom_id
// aqui e o codigo do cupom na AbacatePay (texto), NAO uma FK — a tabela
// cupons_premium_usos e so log pro P&L, a fonte da verdade do cupom e a API.
export async function registrarUsoCupom(
  supabase: ReturnType<typeof usePremiumSupabase>,
  opts: {
    cupomId: string
    pedidoId: string
    email: string
    precoBrutoCentavos: number
    descontoCentavos: number
    precoLiquidoCentavos: number
  },
): Promise<void> {
  try {
    await supabase.from('cupons_premium_usos').insert({
      cupom_id: opts.cupomId,
      pedido_id: opts.pedidoId,
      email: opts.email,
      preco_bruto: opts.precoBrutoCentavos,
      valor_desconto: opts.descontoCentavos,
      preco_liquido: opts.precoLiquidoCentavos,
    })
  } catch (e: any) {
    console.warn('[cupom] registrar uso falhou:', e?.message)
  }
}
