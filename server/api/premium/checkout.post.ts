import crypto from 'node:crypto'
import { sanearOrigem } from '../../../shared/origem-trafego'
import { PLANOS, isPlanoPago } from '../../../shared/planos'

// Cria o pedido (pending) + o Pix transparente. Retorna o QR/copia-e-cola.
// Minimo de dados: email (entrega) + telefone opcional. Gated.
// O plano ('basica' | 'completa') define o valor e, la na frente, quais campos
// do SENATRAN o relatorio libera.
export default defineEventHandler(async (event) => {
  assertPremiumGate(event)
  const body = await readBody(event)
  const placa = String(body.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
  const email = String(body.email || '').trim().toLowerCase()
  const telefone = String(body.telefone || '').replace(/\D/g, '') || null
  // Ambiente das consultas (GCC/SERPRO). SO o build de homolog tem o dropdown
  // que deixa escolher: la o valor do cliente vence (default 'homolog'). Em
  // qualquer outro build (staging espelha prod; prod e prod) o ambiente vindo
  // do body e IGNORADO e forcamos 'producao' — um cliente malicioso nao pode
  // empurrar a consulta pro SERPRO de homologacao em producao.
  const config = useRuntimeConfig()
  const ambiente = config.public.homolog
    ? (body.ambiente === 'producao' ? 'producao' : 'homolog')
    : 'producao'
  if (placa.length < 7) throw createError({ statusCode: 400, message: 'Placa invalida' })
  // E-mail deixou de ser porteira do Pix. Quase metade de quem abria o
  // checkout sumia antes de gerar a cobranca, e o ultimo obstaculo antes de
  // pagar era digitacao. Ele continua obrigatorio pra ENTREGA durar (relatorio
  // no e-mail, recuperacao de Pix abandonado) e e pedido na propria tela do
  // Pix, enquanto a pessoa paga.
  //
  // Duas excecoes onde ele continua obrigatorio AQUI, porque a regra depende
  // dele: cupom (o limite por pessoa e por e-mail, e sem e-mail nao ha limite
  // nenhum) e o caminho gratis, que entrega na hora.
  if (email && !email.includes('@')) {
    throw createError({ statusCode: 400, message: 'E-mail invalido' })
  }
  if (!email && String(body.cupom || '').trim()) {
    throw createError({ statusCode: 400, message: 'Informe o e-mail para usar um cupom.' })
  }

  // Plano vem do cliente, entao nunca confia no preco que ele mandar: o valor
  // sai da tabela do servidor. Default 'completa' preserva o comportamento de
  // quem chamar sem o campo (checkouts antigos em cache, por exemplo).
  const plano = isPlanoPago(body.plano) ? body.plano : 'completa'

  const supabase = usePremiumSupabase()
  const token = crypto.randomBytes(18).toString('base64url')
  // Preco sai SO da tabela. Antes a completa vinha de PREMIUM_VALOR_CENTAVOS,
  // o que abria a porta pra cobrar um valor e mostrar outro na tela (a tela le
  // a tabela). Fonte unica evita a divergencia.
  //
  // Cupom (opcional): RECALCULADO aqui, nunca confia no preco que o client
  // mandou (nem no que /api/premium/coupon devolveu segundos antes — o client
  // podia ter adulterado). Se o codigo mandado nao validar mais por qualquer
  // motivo, o checkout segue com o preco cheio em vez de falhar a compra.
  const codigoCupom = String(body.cupom || '').trim()
  const cupomValidado = codigoCupom
    ? await validarCupom(supabase, codigoCupom, plano, email)
    : null

  // Cupom gratis (permite_gratis + desconto cobre 100%): reivindica a vaga
  // ATOMICAMENTE (trava a linha do cupom no banco) ANTES de criar o pedido.
  // Se a reivindicacao falhar (esgotado ou ja usado por este email), cai pro
  // preco cheio em vez de falhar o checkout — mesma filosofia fail-open dos
  // outros motivos de cupom invalido.
  const tentaGratis = !!(cupomValidado?.ok && cupomValidado.permiteGratis && cupomValidado.precoLiquidoCentavos === 0)
  const gratisReivindicado = tentaGratis && cupomValidado?.cupomId
    ? await reivindicarUsoCupomGratis(supabase, cupomValidado.cupomId, email, cupomValidado.limiteUsoPorCliente)
    : false

  // Se a tentativa de gratis falhou (esgotado/ja usado), NAO usa o preco
  // liquido=0 que o cupom calculou — sem a vaga reivindicada, ninguem leva de
  // graca. Cai pro preco cheio (mais seguro que aplicar so o desconto parcial
  // de um cupom que era, por definicao, "tudo ou nada").
  const valor = gratisReivindicado
    ? 0
    : tentaGratis
      ? PLANOS[plano].valorCentavos
      : (cupomValidado?.ok ? cupomValidado.precoLiquidoCentavos : PLANOS[plano].valorCentavos)

  const { data: pedido, error } = await supabase
    .from('pedidos_premium')
    .insert({
      token_entrega: token, placa, placa_confirmada: true, email: email || null, telefone,
      pix_provider: provedorPix().nome,
      status: 'aguardando_pagamento', valor_centavos: valor, plano,
      preview: body.preview || null,
      ambiente,
      // IP do comprador: usado pra resetar o limite gratis por hora (uma compra
      // paga zera o contador do usuario, casado por IP ou email).
      ip_address: getClientIp(event),
      // Origem do trafego no PROPRIO pedido. Antes ela so existia na consulta
      // gratis e o caminho ate ela era o consulta_id — que aponta pra consulta
      // SENATRAN paga, nao pra `consultas`, entao o join perdia a origem de
      // toda venda. Gravando aqui, a atribuicao para de depender de casar
      // placa com janela de tempo.
      ...sanearOrigem(body.origin),
    })
    .select()
    .single()
  if (error || !pedido) {
    // Pedido nao foi criado: se a gente ja tinha reivindicado a vaga gratis,
    // solta ela de volta (senao o cupom perde um uso sem ninguem ter recebido nada).
    if (gratisReivindicado && cupomValidado?.cupomId) await liberarUsoCupomGratis(supabase, cupomValidado.cupomId)
    throw createError({ statusCode: 500, message: 'Falha ao criar pedido' })
  }

  // Uso do cupom: so registra DEPOIS que o pedido existe (precisa do pedido_id,
  // unique na tabela de usos). Fail-open: erro aqui nao derruba o checkout, o
  // pedido ja foi criado com o preco correto de qualquer forma.
  if (cupomValidado?.ok && cupomValidado.cupomId && (gratisReivindicado || !tentaGratis)) {
    await registrarUsoCupom(supabase, {
      cupomId: cupomValidado.cupomId,
      pedidoId: pedido.id,
      email,
      precoBrutoCentavos: cupomValidado.precoBrutoCentavos,
      descontoCentavos: gratisReivindicado ? cupomValidado.precoBrutoCentavos : cupomValidado.descontoCentavos,
      precoLiquidoCentavos: valor,
      jaReivindicado: gratisReivindicado,
    })
  }

  // Caminho GRATIS: sem Pix nenhum. Marca o pedido pra entrega e dispara na
  // hora — processarPedidoPago ja sabe lidar com abacatepay_id nulo (nao
  // tenta reembolso de uma cobranca que nunca existiu).
  if (gratisReivindicado) {
    await processarPedidoPago(supabase, {
      id: pedido.id, placa, email, token_entrega: token,
      abacatepay_id: null, plano, ambiente, preview: body.preview || null,
      // Caminho gratis: nao ha cobranca, entao nao ha estorno; os campos de
      // alerta vao mesmo assim, pra mensagem nunca sair sem contexto.
      valor_centavos: 0,
    })
    const { data: atualizado } = await supabase
      .from('pedidos_premium')
      .select('status')
      .eq('id', pedido.id)
      .maybeSingle()
    return {
      token, plano, valor: 0, gratis: true, status: atualizado?.status || 'consultando',
      cupomAplicado: { descontoCentavos: cupomValidado!.precoBrutoCentavos },
    }
  }

  // Cliente na AbacatePay: registra quem comprou (rastreio no dashboard) e o id
  // fica guardado no pedido. Fail-open: se falhar, o checkout segue sem o id.
  const customerId = await criarOuObterCliente({ email, telefone })

  // Nome do plano vira a descricao da cobranca; plano+externalId no metadata
  // batem com o produto do catalogo (prod_...). O `customer` inline do
  // transparente exige name+taxId (que nao coletamos), entao amarramos o
  // cliente pelo customerId no metadata (rastreavel no dashboard).
  // Provedor escolhido por env (default abacatepay). O pedido guarda qual foi:
  // sem isso, trocar a env deixaria os pedidos ja criados sem quem responder
  // pelo status e pelo estorno deles.
  const provedor = provedorPix()
  const pix = await provedor.criarPixTransparente({
    amountCentavos: valor,
    pedidoId: pedido.id,
    expiresIn: 900,
    descricao: PLANOS[plano].nome,
    metadata: { plano, externalId: `plano-${plano}`, ...(customerId ? { customerId } : {}) },
  })
  await supabase
    .from('pedidos_premium')
    .update({ abacatepay_id: pix.id, br_code: pix.brCode, expira_em: pix.expiresAt, abacatepay_customer_id: customerId })
    .eq('id', pedido.id)

  return {
    token, plano, brCode: pix.brCode, brCodeBase64: pix.brCodeBase64, expiresAt: pix.expiresAt, valor,
    // Nome que vai aparecer como recebedor no app do banco. Vem do provedor
    // DESTA cobranca, e nao de uma constante na tela: quando a conta mudar, a
    // frase muda junto. Null quando ainda nao confirmamos num Pix real, e ai a
    // tela nao promete nome nenhum.
    recebedor: provedor.nomeDoRecebedor(),
    // tentaGratis-e-falhou cai aqui com preco cheio: nesse caso NAO aplicou
    // desconto nenhum (a vaga gratis nao foi concedida), entao nao anuncia
    // cupom aplicado pro client.
    cupomAplicado: (cupomValidado?.ok && !tentaGratis) ? { descontoCentavos: cupomValidado.descontoCentavos } : null,
  }
})
