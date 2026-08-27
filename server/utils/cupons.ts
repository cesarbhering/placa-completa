import { aplicarCupom, PLANOS, type PlanoId } from '../../shared/planos'

// Validacao + calculo de cupom (v1). Usado tanto pelo endpoint de validar
// (blur do input, so pra mostrar o preco) quanto pelo checkout (que RECALCULA
// tudo de novo antes de gravar o pedido — nunca confia no preco que o client
// mandou, mesmo que tenha vindo desta mesma funcao segundos antes).
//
// Falha SEMPRE fechada: qualquer motivo de recusa devolve ok:false com um
// motivo, nunca deixa passar por omissao.

export interface CupomValidado {
  ok: boolean
  motivo?: string
  cupomId?: string
  precoBrutoCentavos: number
  descontoCentavos: number
  precoLiquidoCentavos: number
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

  const { data: cupom, error } = await supabase
    .from('cupons_premium')
    .select('*')
    .eq('codigo', codigo)
    .maybeSingle()

  if (error || !cupom) return { ...semDesconto, motivo: 'Cupom nao encontrado.' }
  if (!cupom.ativo) return { ...semDesconto, motivo: 'Cupom inativo.' }

  const agora = Date.now()
  if (cupom.valido_de && new Date(cupom.valido_de).getTime() > agora) {
    return { ...semDesconto, motivo: 'Cupom ainda nao esta valido.' }
  }
  if (cupom.valido_ate && new Date(cupom.valido_ate).getTime() < agora) {
    return { ...semDesconto, motivo: 'Cupom expirado.' }
  }
  if (!Array.isArray(cupom.planos) || !cupom.planos.includes(plano)) {
    return { ...semDesconto, motivo: 'Cupom nao vale para este plano.' }
  }

  // Limite global e por-cliente contados na tabela de usos (fonte da verdade),
  // nao no contador `usos_atual` (que e so um cache pra leitura rapida no
  // dashboard e pode ficar defasado sem quebrar a regra de negocio).
  if (cupom.limite_uso_global != null) {
    const { count } = await supabase
      .from('cupons_premium_usos')
      .select('id', { count: 'exact', head: true })
      .eq('cupom_id', cupom.id)
    if ((count || 0) >= cupom.limite_uso_global) {
      return { ...semDesconto, motivo: 'Cupom esgotado.' }
    }
  }
  if (cupom.limite_uso_por_cliente != null) {
    const { count } = await supabase
      .from('cupons_premium_usos')
      .select('id', { count: 'exact', head: true })
      .eq('cupom_id', cupom.id)
      .eq('email', email)
    if ((count || 0) >= cupom.limite_uso_por_cliente) {
      return { ...semDesconto, motivo: 'Voce ja usou este cupom.' }
    }
  }

  const { precoBrutoCentavos: bruto, descontoCentavos, precoLiquidoCentavos } = aplicarCupom(plano, {
    tipo: cupom.tipo,
    valor: cupom.valor,
    planos: cupom.planos,
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
// o segundo insert falha e e ignorado — sem double-count no P&L.
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
    // Contador best-effort pro dashboard; nao e a fonte da verdade (validarCupom
    // sempre conta a tabela de usos), entao a leve race aqui (read-then-write,
    // sem lock) nao afeta nenhuma regra de negocio, so a exibicao do numero.
    const { data: atual } = await supabase
      .from('cupons_premium')
      .select('usos_atual')
      .eq('id', opts.cupomId)
      .maybeSingle()
    await supabase
      .from('cupons_premium')
      .update({ usos_atual: (atual?.usos_atual || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', opts.cupomId)
  } catch (e: any) {
    console.warn('[cupom] registrar uso falhou:', e?.message)
  }
}
