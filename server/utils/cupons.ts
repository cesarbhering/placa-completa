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
  /**
   * true = cupom pessoal validado sem e-mail (prefill pelo link do e-mail).
   * O desconto ja aparece, mas so vale mesmo pra quem digitar o e-mail certo,
   * e o checkout final revalida com o e-mail antes de cobrar.
   */
  exigeEmail?: boolean
  /** true = este cupom pode zerar o preco (bypass do Pix), se o desconto cobrir tudo. */
  permiteGratis?: boolean
  limiteUsoPorCliente?: number | null
}

/**
 * "07/09 as 18h30". Fuso de Brasilia fixo: o prazo do cupom e o prazo que o
 * e-mail prometeu, e o e-mail foi escrito no horario daqui, nao no do celular
 * de quem viajou.
 */
function formatarVencimento(iso: string): string {
  const d = new Date(iso)
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const g = (t: string) => partes.find(p => p.type === t)?.value || ''
  return `${g('day')}/${g('month')} as ${g('hour')}h${g('minute')}`
}

export async function validarCupom(
  supabase: ReturnType<typeof usePremiumSupabase>,
  codigoBruto: string,
  plano: PlanoId,
  // Opcional: na validacao previa (pessoa digitou o cupom antes do e-mail) o
  // limite por cliente e simplesmente pulado. O checkout final SEMPRE chama
  // esta funcao com o e-mail, entao a regra continua valendo onde importa.
  email?: string,
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
    // Vencido merece data e hora, nao um "invalido" generico: o cupom de
    // recuperacao dura 24 horas e quem chega 10 minutos tarde precisa entender
    // que perdeu o prazo, nao achar que digitou errado.
    return { ...semDesconto, motivo: `Este cupom venceu em ${formatarVencimento(cupom.valido_ate)}.` }
  }
  if (!Array.isArray(cupom.planos) || !cupom.planos.includes(plano)) {
    return { ...semDesconto, motivo: 'Cupom nao vale para este plano.' }
  }

  // Cupom pessoal (recuperacao de Pix abandonado): vale so pra quem recebeu.
  // Sem isto, o codigo do e-mail de uma pessoa viraria desconto pra qualquer um
  // que o repassasse. Comparacao sem caixa: quem digita o proprio e-mail no
  // checkout escreve como quiser.
  let exigeEmail = false
  if (cupom.email_restrito) {
    // Sem e-mail ainda (o link do e-mail abre o checkout com o cupom pronto,
    // antes de a pessoa digitar qualquer coisa): mostra o desconto e avisa que
    // ele depende do e-mail. Nao e brecha: o checkout SEMPRE revalida com o
    // e-mail preenchido, e la a regra abaixo derruba quem nao for o dono.
    if (!email) exigeEmail = true
    else if (String(cupom.email_restrito).trim().toLowerCase() !== email.trim().toLowerCase()) {
      // Nunca revelar QUAL e-mail: o codigo pode ter sido repassado, e o
      // destinatario original nao autorizou ninguem a descobrir o e-mail dele.
      return { ...semDesconto, motivo: 'Este cupom e pessoal e vale so para o e-mail que o recebeu.' }
    }
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
      // Cupom de uso unico ja gasto: a pessoa precisa saber que ele funcionou
      // uma vez, senao tenta de novo achando que e erro do site.
      return { ...semDesconto, motivo: cupom.limite_uso_global === 1 ? 'Este cupom ja foi utilizado.' : 'Cupom esgotado.' }
    }
  }
  if (cupom.limite_uso_por_cliente != null && email) {
    const { count } = await supabase
      .from('cupons_premium_usos')
      .select('id', { count: 'exact', head: true })
      .eq('cupom_id', cupom.id)
      .eq('email', email)
    if ((count || 0) >= cupom.limite_uso_por_cliente) {
      return { ...semDesconto, motivo: 'Este cupom ja foi utilizado.' }
    }
  }

  const { precoBrutoCentavos: bruto, descontoCentavos, precoLiquidoCentavos } = aplicarCupom(plano, {
    tipo: cupom.tipo,
    valor: cupom.valor,
    planos: cupom.planos,
    permiteGratis: !!cupom.permite_gratis,
  })

  return {
    ok: true,
    cupomId: cupom.id,
    precoBrutoCentavos: bruto,
    descontoCentavos,
    precoLiquidoCentavos,
    exigeEmail,
    permiteGratis: !!cupom.permite_gratis,
    limiteUsoPorCliente: cupom.limite_uso_por_cliente,
  }
}

/**
 * SO pro caminho gratis (preco liquido = 0): reivindica atomicamente 1 uso do
 * cupom via RPC que trava a linha do cupom (evita corrida — sem isso, duas
 * requisicoes concorrentes podiam ler o mesmo contador e as duas passarem, e
 * cada resgate da completa custa ~R$5 de SERPRO real). Chamar ANTES de criar
 * o pedido; se devolver false, NAO libera o relatorio de graca (cai pro preco
 * cheio, tratado por quem chamou).
 */
export async function reivindicarUsoCupomGratis(
  supabase: ReturnType<typeof usePremiumSupabase>,
  cupomId: string,
  email: string,
  limitePorCliente: number | null | undefined,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('reivindicar_uso_cupom_gratis', {
    p_cupom_id: cupomId,
    p_email: email,
    p_limite_por_cliente: limitePorCliente ?? null,
  })
  if (error) {
    console.warn('[cupom] reivindicar uso gratis falhou:', error.message)
    return false
  }
  return !!data
}

/** Contrapartida do reivindicar: solta a vaga se o pedido nao puder ser criado depois. */
export async function liberarUsoCupomGratis(
  supabase: ReturnType<typeof usePremiumSupabase>,
  cupomId: string,
): Promise<void> {
  try {
    await supabase.rpc('liberar_uso_cupom_gratis', { p_cupom_id: cupomId })
  } catch (e: any) {
    console.warn('[cupom] liberar uso gratis falhou:', e?.message)
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
    /**
     * true quando reivindicarUsoCupomGratis() ja incrementou usos_atual pra
     * este uso (caminho gratis) — evita contar 2x. false/omitido = caminho
     * normal (pago com desconto), incrementa aqui mesmo (best-effort).
     */
    jaReivindicado?: boolean
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
    if (opts.jaReivindicado) return
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
