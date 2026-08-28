import { Resend } from 'resend'
import { isValidEmail, isValidPlate, isValidPhone, sanitizeEmail } from '../utils/validation'
import { checkEmailDeliverability } from '../utils/email-deliverability'
import { getClientIp } from '../utils/client-ip'
import { lookupIpGeo } from '../utils/ip-geo'
import { getRegiaoSusep } from '../utils/regiao-susep'
import { getSeguroEstimado, type SeguroEstimado } from '../utils/seguro-estimate'
import { getHourlyLimit, DEFAULT_HOURLY_LIMIT } from '../utils/rate-limit-whitelist'
import { calcularICV5, inferirCategoria, type ICV5Result } from '../utils/icv5'
import { sendWhatsAppText, sendWhatsAppImage, normalizePhoneForWhatsApp } from '../utils/evolutionApi'
import { renderHtmlToPng } from '../utils/htmlToImage'

/**
 * Registra a consulta e RECLAMA se o banco recusar.
 *
 * Antes era `await supabase.from('consultas').insert(...)` puro. O cliente do
 * Supabase nao lanca excecao em erro: devolve `{ error }`. Sem checar, uma
 * falha de gravacao passava calada — a tela mostrava sucesso e o registro
 * nunca acontecia. Foi assim que a constraint do canal 'tela' ficou escondida
 * por horas, com o contador e o rate limit por IP zerados o tempo todo.
 *
 * O erro vai pro log do servidor, nunca pra resposta: quem consultou nao tem
 * o que fazer com isso, e a consulta em si deu certo.
 */
async function registrarConsulta(supabase: any, row: Record<string, any>, origem: string) {
  const { error } = await supabase.from('consultas').insert(row)
  if (error) {
    console.error(
      `[consultas] insert falhou (${origem}): ${error.message}` +
      (error.code ? ` [${error.code}]` : '') +
      (error.details ? ` — ${error.details}` : ''),
    )
  }
  return !error
}

// 'tela': consulta gratis sem coleta de contato. Roda a consulta, registra e
// devolve o bloco basico pra pagina mostrar. Nao envia nada, entao nao pede
// nem valida e-mail/telefone.
type Channel = 'email' | 'whatsapp' | 'tela'

// Mostra o inicio do chassi e esconde o resto: o comprador confere contra o
// documento sem que a superficie gratis entregue o numero inteiro.
function mascararChassi(chassi: unknown): string | null {
  const c = String(chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (c.length < 8) return null
  const visivel = c.slice(0, 5)
  return visivel + '*'.repeat(c.length - visivel.length)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  // Barragem de clients de script (Postman, curl, python etc) - PRIMEIRA
  // checagem do handler, antes de qualquer validacao. User-agent e
  // falsificavel: lombada contra scraper preguicoso, nao muralha; o rate
  // limit continua sendo a contencao real. Log em blocked_requests.
  const uaCheck = getRequestHeaders(event)['user-agent'] || ''
  const UA_BLOQUEADOS = /postmanruntime|curl\/|wget\/|python-requests|python-urllib|httpie|insomnia|axios\/|go-http-client|okhttp|libwww|scrapy|aiohttp/i
  if (!uaCheck || UA_BLOQUEADOS.test(uaCheck)) {
    const supabaseUa = useSupabaseServer()
    supabaseUa.from('blocked_requests').insert({
      reason: 'blocked_user_agent',
      ip_address: getClientIp(event),
      recipient: typeof body?.email === 'string' ? body.email.slice(0, 200) : null,
      placa: typeof body?.placa === 'string' ? body.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7) : null,
      user_agent: (uaCheck || 'vazio').slice(0, 300),
    }).then(({ error }) => { if (error) console.warn('[blocked_requests] insert falhou:', error.message) })
    throw createError({ statusCode: 403, message: 'Acesso não autorizado.' })
  }

  // Blocklist de contencao pontual (IPs/e-mails de abuso confirmado). Mesmo
  // esquema do UA: 403 ANTES de qualquer consulta paga, log em blocked_requests.
  // Escala pra abuso especifico; o rate-limit por IP abaixo e a contencao geral.
  const IP_BLOQUEADOS = new Set<string>(['177.44.134.147'])
  const EMAIL_BLOQUEADOS = new Set<string>(['bloqueado@example.com'])
  const ipInicial = getClientIp(event)
  const emailInicial = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (IP_BLOQUEADOS.has(ipInicial) || (emailInicial && EMAIL_BLOQUEADOS.has(emailInicial))) {
    const supabaseBl = useSupabaseServer()
    supabaseBl.from('blocked_requests').insert({
      reason: 'blocklist',
      ip_address: ipInicial,
      recipient: emailInicial ? emailInicial.slice(0, 200) : null,
      placa: typeof body?.placa === 'string' ? body.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7) : null,
      user_agent: (uaCheck || 'vazio').slice(0, 300),
    }).then(({ error }) => { if (error) console.warn('[blocked_requests] insert falhou:', error.message) })
    throw createError({ statusCode: 403, message: 'Acesso não autorizado.' })
  }

  const { email, phone, placa, isPWA, includeFipeChart, includeIcv5, icv5Uf } = body
  // Origem de trafego (gclid/utm) capturada pelo plugin track-origin no client
  const origin = body?.origin && typeof body.origin === 'object' ? body.origin : {}
  const trafego = {
    gclid: typeof origin.gclid === 'string' ? origin.gclid.slice(0, 200) : null,
    utm_source: typeof origin.utm_source === 'string' ? origin.utm_source.slice(0, 100) : null,
    utm_medium: typeof origin.utm_medium === 'string' ? origin.utm_medium.slice(0, 100) : null,
    utm_campaign: typeof origin.utm_campaign === 'string' ? origin.utm_campaign.slice(0, 150) : null,
  }
  const channel: Channel =
    body.channel === 'whatsapp' ? 'whatsapp'
    : body.channel === 'tela' ? 'tela'
    : 'email'

  if (!placa) {
    throw createError({ statusCode: 400, message: 'Placa é obrigatória.' })
  }

  // Channel-specific validation. WhatsApp is web-only — PWA always uses
  // the inline-data path, so isPWA + channel=whatsapp would be ambiguous.
  if (channel === 'tela') {
    // Sem destinatario nao ha o que validar. O freio de abuso aqui e o rate
    // limit por IP, ja aplicado abaixo.
  } else if (channel === 'whatsapp') {
    // Feature flag — UI hides the toggle when whatsappEnabled is false,
    // but a crafted POST can still reach us. Refuse here too.
    const whatsappEnabled =
      Boolean(config.public?.whatsappEnabled) ||
      process.env.NUXT_PUBLIC_WHATSAPP_ENABLED === 'true'
    if (!whatsappEnabled) {
      throw createError({
        statusCode: 503,
        message: 'Envio por WhatsApp temporariamente indisponível. Selecione e-mail.',
      })
    }
    if (isPWA) {
      throw createError({ statusCode: 400, message: 'WhatsApp não disponível no modo PWA.' })
    }
    if (!phone) {
      throw createError({ statusCode: 400, message: 'Telefone é obrigatório para envio via WhatsApp.' })
    }
    if (!isValidPhone(phone)) {
      throw createError({ statusCode: 400, message: 'Telefone inválido.' })
    }
  } else {
    if (!email) {
      throw createError({ statusCode: 400, message: 'E-mail é obrigatório.' })
    }
    if (!isValidEmail(email)) {
      throw createError({ statusCode: 400, message: 'E-mail inválido.' })
    }
    if (phone && !isValidPhone(phone)) {
      throw createError({ statusCode: 400, message: 'Telefone inválido.' })
    }

    // Deliverability (etapa 1, sem porta 25): typo -> sugestao clicavel na UI;
    // descartavel/no-MX -> bloqueia ANTES de gastar a consulta paga.
    const deliv = await checkEmailDeliverability(email)
    if (!deliv.ok) {
      if (deliv.reason === 'typo' && deliv.suggestion) {
        throw createError({
          statusCode: 422,
          message: 'Verifique o e-mail digitado.',
          data: { suggestion: deliv.suggestion },
        })
      }
      if (deliv.reason === 'disposable') {
        throw createError({
          statusCode: 422,
          message: 'E-mails temporários não são aceitos. Use seu e-mail real para receber o resultado.',
        })
      }
      throw createError({
        statusCode: 422,
        message: 'Este e-mail não parece receber mensagens. Confira se digitou certo.',
      })
    }
  }

  // Sanitize email to prevent injection + normalize case for consistent dedupe.
  // For whatsapp-only consultas there is no email; we store NULL.
  const sanitizedEmail = email ? sanitizeEmail(email).toLowerCase() : null
  // Phone normalized to E.164-without-plus for both delivery and dedupe.
  const normalizedPhone = phone ? normalizePhoneForWhatsApp(phone) : null
  if (channel === 'whatsapp' && !normalizedPhone) {
    throw createError({ statusCode: 400, message: 'Telefone inválido.' })
  }

  const headers = getRequestHeaders(event)
  const ip = getClientIp(event)
  const userAgent = headers['user-agent'] || 'unknown'
  // Geo por IP (cacheado; fail-open pra null). Precisao de cidade e
  // aproximada em mobile/CGNAT - tratar como regiao provavel.
  const ipGeo = await lookupIpGeo(ip)
  const regiao = ipGeo?.country === 'BR' ? getRegiaoSusep(ipGeo.uf, ipGeo.city) : null
  // UUID da consulta gerado ANTES do envio: vira o token do link de cotacao
  // no email (/cotacao?c=<uuid>) e e passado como id explicito no insert final.
  const consultaId = crypto.randomUUID()
  const cotacaoUrl = `https://placacompleta.com.br/cotacao?c=${consultaId}`

  const placaClean = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
  if (!placaRegex.test(placaClean)) {
    throw createError({ statusCode: 400, message: 'Formato de placa inválido.' })
  }

  const isMobile = /mobile|android|iphone/i.test(userAgent)
  const deviceInfo = isMobile ? 'Mobile' : 'Desktop'

  // Rate limit: 5 successful consultas per hour per recipient AND per IP (web only — PWA bypasses).
  // The "recipient" field switches with the channel so each delivery medium has its own quota.
  // Skips IP check when IP is 'unknown' to avoid penalising users behind shared/proxied connections.
  const recipientField = channel === 'whatsapp' ? 'phone' : 'email'
  const recipientValue = channel === 'whatsapp' ? normalizedPhone : sanitizedEmail
  const sentField = channel === 'whatsapp' ? 'whatsapp_sent' : 'email_sent'
  // No canal 'tela' nao existe destinatario: o unico limite e o do IP. Sem
  // isso o teto por hora sumiria junto com o e-mail e a consulta paga ficaria
  // aberta pra raspagem.
  const semDestinatario = channel === 'tela'

  // Limite customizado por destinatario (tabela rate_limit_whitelist):
  // N/hora ou ilimitado (Infinity). Aplica aos DOIS checks (destinatario e
  // IP), senao o proprio IP bloquearia antes do limite customizado valer.
  const hourlyLimit = semDestinatario
    ? await getHourlyLimit('')   // sem destinatario: cai no limite padrao
    : await getHourlyLimit(recipientValue as string)

  // Vale pra web E PWA: sem isso, um POST com isPWA:true pulava o rate
  // limit e recebia o apiResponse completo - consultas ilimitadas de graca
  // na API paga (fechado em 28/jul/2026).
  // No homolog (ambiente de teste) o teto por hora nao se aplica: quem testa
  // precisa consultar a vontade. Prod segue com o limite normal.
  if (hourlyLimit !== Infinity && !config.public.homolog) {
    const supabase = useSupabaseServer()
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const ipCheckable = ip && ip !== 'unknown'

    // Reset apos compra paga: se o usuario tem um pedido premium PAGO na ultima
    // hora (casado por IP ou email), a janela de contagem gratis comeca no
    // pagamento -> ele volta a ter o teto cheio (as consultas de antes nao
    // contam). Quem pagou nao pode ser barrado no gratis — vale mesmo se a
    // consulta falhou/estornou depois (pago_em preenchido = pagamento entrou).
    // A tabela usa `pago_em`/`criado_em` (nao created_at): usar a coluna errada
    // fazia a query dar erro e o reset nunca acontecer.
    let janelaInicio = oneHourAgo
    try {
      const orParts: string[] = []
      if (ipCheckable) orParts.push(`ip_address.eq.${ip}`)
      if (!semDestinatario && recipientValue) orParts.push(`email.eq.${recipientValue}`)
      if (orParts.length) {
        const premium = usePremiumSupabase()
        const { data: pago } = await premium
          .from('pedidos_premium')
          .select('pago_em')
          .not('pago_em', 'is', null)
          .or(orParts.join(','))
          .gte('pago_em', oneHourAgo)
          .order('pago_em', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (pago?.pago_em) janelaInicio = new Date(pago.pago_em).toISOString()
      }
    } catch { /* premium nao configurado ou lookup falhou: sem reset */ }

    // ===== FURO FECHADO: teto por IP que conta TODAS as chamadas wdapi =====
    // Cada row de `consultas` = 1 chamada a wdapi (API paga), independente de
    // canal ('tela'/PWA/email/whatsapp), isPWA ou email_sent. O check por
    // destinatario/sent mais abaixo e so a UX de "N entregas/hora" e deixava
    // passar o path inline (email_sent=false) — foi por onde um bot enumerou
    // placas e drenou os creditos. Aqui contamos TODAS as rows do IP na janela e
    // barramos ANTES da wdapi. Vale pra web E app/PWA (pedido do Cesar).
    // Teto de 15/IP/hora (decisao do Cesar): meio-termo entre 5 (restritivo) e
    // 30, com folga pra CGNAT de operadora movel (88% do trafego e mobile, e o
    // 4G/5G empilha varios usuarios reais num mesmo IP publico). Barra a
    // enumeracao (o ataque foi 47 em 15 min) sem falso-positivar o app legitimo.
    // Vale igual pra web e app/PWA, sem excecao. Um atacante nao paga, entao o
    // reset pos-compra (janelaInicio) nao abre brecha e protege quem pagou. O
    // limite por destinatario/email segue 5/h. Escape via rate_limit_whitelist
    // (whitelistar um IP pra Infinity ou teto maior).
    const IP_WDAPI_HOURLY_LIMIT = 15
    if (ipCheckable) {
      const ipLimit = await getHourlyLimit(ip)
      if (ipLimit !== Infinity) {
        const teto = Math.max(IP_WDAPI_HOURLY_LIMIT, ipLimit)
        const { count: ipWdapiCount, data: ipWdapiRows } = await supabase
          .from('consultas')
          .select('created_at', { count: 'exact' })
          .eq('ip_address', ip)
          .gte('created_at', janelaInicio)
          .order('created_at', { ascending: true })
          .limit(1)
        if ((ipWdapiCount ?? 0) >= teto) {
          const oldestIso = ipWdapiRows?.[0]?.created_at
          let minutesUntilReset = 60
          if (oldestIso) {
            const minutesElapsed = Math.floor((Date.now() - new Date(oldestIso).getTime()) / 60000)
            minutesUntilReset = Math.max(1, 60 - minutesElapsed)
          }
          supabase.from('blocked_requests').insert({
            reason: 'rate_limit_ip_wdapi',
            ip_address: ip,
            recipient: recipientValue ?? null,
            placa: placaClean || null,
            user_agent: userAgent,
          }).then(({ error }) => { if (error) console.warn('[blocked_requests] insert falhou:', error.message) })
          throw createError({
            statusCode: 429,
            message: `Limite de ${teto} consultas por hora atingido. Tente novamente em ~${minutesUntilReset} min.`,
          })
        }
      }
    }

    const vazio = Promise.resolve({ count: 0, data: null, error: null } as any)

    const [recipientRes, ipRes] = await Promise.all([
      // Sem destinatario nao ha o que contar por destinatario.
      semDestinatario
        ? vazio
        : supabase
            .from('consultas')
            .select('created_at', { count: 'exact' })
            .eq(recipientField, recipientValue as string)
            .eq(sentField, true)
            .gte('created_at', janelaInicio)
            .order('created_at', { ascending: true })
            .limit(1),
      ipCheckable
        ? (() => {
            const q = supabase
              .from('consultas')
              .select('created_at', { count: 'exact' })
              .eq('ip_address', ip)
              .gte('created_at', janelaInicio)
            // No canal 'tela' nada e "enviado", entao filtrar por sentField=true
            // zeraria o contador e o teto por IP deixaria de existir — consulta
            // paga aberta pra raspagem. Aqui o criterio e ter havido consulta.
            return (semDestinatario ? q.eq('channel', 'tela') : q.eq(sentField, true))
              .order('created_at', { ascending: true })
              .limit(1)
          })()
        : vazio,
    ])

    const recipientCount = recipientRes?.count ?? 0
    const ipCount = ipRes?.count ?? 0

    if (recipientCount >= hourlyLimit || ipCount >= hourlyLimit) {
      const oldestIso = recipientCount >= hourlyLimit
        ? recipientRes?.data?.[0]?.created_at
        : ipRes?.data?.[0]?.created_at
      let minutesUntilReset = 60
      if (oldestIso) {
        const minutesElapsed = Math.floor((Date.now() - new Date(oldestIso).getTime()) / 60000)
        minutesUntilReset = Math.max(1, 60 - minutesElapsed)
      }

      // Log duravel do bloqueio (fire-and-forget): 429 nao aparece nos logs
      // do container e docker logs morrem a cada deploy. Sem await pra nao
      // atrasar a resposta; falha de insert nao afeta o usuario.
      supabase.from('blocked_requests').insert({
        reason: recipientCount >= hourlyLimit ? 'rate_limit_recipient' : 'rate_limit_ip',
        ip_address: ip,
        recipient: recipientValue as string,
        placa: placa?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null,
        user_agent: userAgent,
      }).then(({ error }) => {
        if (error) console.warn('[blocked_requests] insert falhou:', error.message)
      })

      throw createError({
        statusCode: 429,
        message: `Limite de ${hourlyLimit} consultas por hora atingido. Tente novamente em ~${minutesUntilReset} min.`,
      })
    }
  }

  // Dedupe per channel: same recipient + same placa in the last hour → skip the
  // paid API call and tell the user the delivery already went out. Non-PWA only.
  // Pulado no homolog: testar a mesma placa varias vezes nao pode ser barrado.
  if (!isPWA && !config.public.homolog) {
    const supabase = useSupabaseServer()
    const { data: existing, error: dedupeError } = await supabase
      .from('consultas')
      .select('created_at')
      .eq(recipientField, recipientValue as string)
      .eq('placa', placaClean)
      .eq(sentField, true)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dedupeError) {
      console.warn('[dedupe] Supabase error:', dedupeError.message)
    }

    if (existing) {
      const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(existing.created_at).getTime()) / 60000))
      const where = channel === 'whatsapp'
        ? `enviado por WhatsApp para o número informado`
        : `enviado para ${sanitizedEmail}`
      return {
        success: true,
        emailSent: channel === 'email',
        whatsappSent: channel === 'whatsapp',
        channel,
        message: `Você já consultou essa placa há ${minutesAgo === 1 ? 'menos de 1 minuto' : `${minutesAgo} min`}. O resultado foi ${where} — verifique seu histórico.`,
      }
    }
  }

  let apiResponse = null
  let emailSent = false
  let whatsappSent = false

  try {
    // Via cache (placa_cache) pra nao pagar a wdapi de novo na mesma placa.
    // Ver server/utils/placa-lookup.ts.
    const apiResult = await consultarPlacaWdapi(placaClean)
    if (!apiResult) throw new Error('Sem retorno da API de placas')
    apiResponse = apiResult
  } catch (err: any) {
    // Send error email
    await sendErrorEmail({
      endpoint: '/api/consulta',
      errorMessage: err?.message || 'Erro ao consultar API de placas',
      errorStack: err?.stack,
      requestBody: { placa: placaClean, isPWA, channel },
      userAgent,
      ip,
      timestamp: new Date().toISOString(),
    })

    const supabase = useSupabaseServer()
    await registrarConsulta(supabase, {
      email: sanitizedEmail,
      phone: normalizedPhone,
      placa: placaClean,
      ip_address: ip,
      geo_city: ipGeo?.city ?? null,
      geo_uf: ipGeo?.uf ?? null,
      geo_country: ipGeo?.country ?? null,
      geo_region_code: regiao?.code ?? null,
      ...trafego,
      user_agent: userAgent,
      device_info: deviceInfo,
      is_pwa: isPWA || false,
      channel,
      email_sent: false,
      whatsapp_sent: false,
      api_response: null,
    }, 'pwa')
    throw createError({ statusCode: 502, message: 'Erro ao consultar dados da placa. Tente novamente.' })
  }

  if (apiResponse?.codigoRetorno === 0 || apiResponse?.mensagemRetorno === 'Sem erros.') {
    // noop - success
  } else if (apiResponse?.MARCA || apiResponse?.marca) {
    // also valid response
  } else {
    const supabase = useSupabaseServer()
    await registrarConsulta(supabase, {
      email: sanitizedEmail,
      phone: normalizedPhone,
      placa: placaClean,
      ip_address: ip,
      geo_city: ipGeo?.city ?? null,
      geo_uf: ipGeo?.uf ?? null,
      geo_country: ipGeo?.country ?? null,
      geo_region_code: regiao?.code ?? null,
      ...trafego,
      user_agent: userAgent,
      device_info: deviceInfo,
      is_pwa: isPWA || false,
      channel,
      email_sent: false,
      whatsapp_sent: false,
      api_response: apiResponse,
    }, 'erro-api')
    throw createError({ statusCode: 404, message: 'Placa não encontrada ou sem dados disponíveis.' })
  }

  // Fetch FIPE price history (best-effort). Web usa pra montar o chart do
  // e-mail (QuickChart); PWA recebe os pontos estruturados e renderiza na tela.
  let chartUrl: string | null = null
  let fipeHistoryPoints: { label: string; price: number }[] | null = null
  let fipeModelId: number | null = null
  if (includeFipeChart !== false) {
    try {
      const fipeDados = apiResponse.fipe?.dados
      if (fipeDados?.length) {
        // Pick the FIPE item with highest score
        const bestFipe = fipeDados.reduce((best: any, item: any) =>
          (item.score || 0) > (best.score || 0) ? item : best, fipeDados[0])
        const fipeCode = bestFipe.codigo_modelo

        if (fipeCode) {
          const historyData = await $fetch<any>(
            `${config.fipeApiUrl}/models/fipe/${fipeCode}/price-history`,
            { headers: { Authorization: `Bearer ${config.fipeApiToken}` } }
          )
          const normalized = historyData?.data || historyData
          fipeModelId = normalized?.model?.id ?? null
          if (isPWA) {
            fipeHistoryPoints = buildHistoryPoints(normalized, apiResponse.anoModelo)
          } else {
            chartUrl = buildChartUrl(normalized, apiResponse.anoModelo, bestFipe.texto_modelo)
          }
        }
      }
    } catch (err) {
      // Non-critical — segue sem chart
      console.warn('Failed to fetch FIPE history for chart:', err)
    }
  }

  // Estimativa de seguro (web apenas) — fipe-api/SUSEP; fail-open: null = modal nao aparece
  let seguroEstimado: SeguroEstimado | null = null
  if (!isPWA && fipeModelId) {
    const anoSeguro = parseInt(String(apiResponse.anoModelo || apiResponse.ano || ''), 10)
    if (anoSeguro) {
      seguroEstimado = await getSeguroEstimado({
        fipeModelId,
        ano: anoSeguro,
        regiaoCode: regiao?.code ?? null,
        marca: apiResponse.MARCA || apiResponse.marca || '',
        modelo: apiResponse.MODELO || apiResponse.modelo || '',
      })
      // % do FIPE: metrica universal ("seguro = X% do valor do carro")
      if (seguroEstimado) {
        try {
          const fipeDados2 = apiResponse.fipe?.dados
          const best = fipeDados2?.length
            ? fipeDados2.reduce((b: any, i: any) => (i.score || 0) > (b.score || 0) ? i : b, fipeDados2[0])
            : null
          const valorNum = best?.texto_valor
            ? parseFloat(String(best.texto_valor).replace(/[^\d,]/g, '').replace(',', '.'))
            : null
          if (valorNum && valorNum > 1000) {
            ;(seguroEstimado as any).percentualFipe = Math.round((seguroEstimado.premioAnual / valorNum) * 1000) / 10
          }
        } catch { /* metrica opcional */ }
      }
    }
  }

  // Calculate ICV5 (web only)
  let icv5Result: ICV5Result | null = null
  if (!isPWA && includeIcv5 !== false && icv5Uf) {
    try {
      const fipeDados = apiResponse.fipe?.dados
      if (fipeDados?.length) {
        const bestFipe = fipeDados.reduce((best: any, item: any) =>
          (item.score || 0) > (best.score || 0) ? item : best, fipeDados[0])

        // Parse valor FIPE: "R$ 28.799,00" -> 28799
        const textoValor = bestFipe.texto_valor || ''
        const valorFipe = parseFloat(textoValor.replace(/[^\d,]/g, '').replace(',', '.'))

        const anoFab = parseInt(String(apiResponse.ano)) || new Date().getFullYear()
        const extra = apiResponse.extra || {}
        const categoria = inferirCategoria(extra.sub_segmento || '', extra.combustivel || '')

        if (valorFipe > 0) {
          icv5Result = calcularICV5({ valorFipe, anoFabricacao: anoFab, uf: icv5Uf, categoria })
        }
      }
    } catch (err) {
      console.warn('Failed to calculate ICV5:', err)
    }
  }

  // Delivery — only for non-PWA web requests. PWA returns inline data.
  // 'tela' nao entrega por canal nenhum: o resultado vai pra propria pagina.
  // Sem esta guarda o `else` do e-mail cairia no ramo do WhatsApp.
  if (!isPWA && channel !== 'tela') {
    const rodizio = icv5Uf === 'SP' ? getSpRodizioInfo(placaClean) : null
    if (channel === 'email') {
      try {
        const resend = new Resend(config.resendApiKey)
        const htmlEmail = buildEmailHtml(apiResponse, placaClean, chartUrl, icv5Result, rodizio, seguroEstimado, cotacaoUrl)
        await resend.emails.send({
          from: 'PlacaCompleta <consulta@placacompleta.com.br>',
          to: sanitizedEmail as string,
          subject: `PlacaCompleta - Consulta Veicular ${placaClean}`,
          html: htmlEmail,
        })
        emailSent = true
      } catch (err: any) {
        console.error('Resend error:', err)
        await sendErrorEmail({
          endpoint: '/api/consulta (email sending)',
          errorMessage: `Failed to send email to ${email}: ${err?.message}`,
          errorStack: err?.stack,
          requestBody: { placa: placaClean },
          userAgent,
          ip,
          timestamp: new Date().toISOString(),
        })
      }
    } else {
      // channel === 'whatsapp'. Delivery ladder, best first:
      //
      //   A) Rich card: prefetch chart as base64, build self-contained
      //      HTML, render to PNG via Gotenberg, send inline. This is
      //      the "feels like the email" delivery — same data, single
      //      well-formatted image.
      //   B) Chart-only image: if Gotenberg is unavailable or rendering
      //      fails, fall back to the QuickChart watermark image with
      //      text caption.
      //   C) Plain text: if image delivery fails altogether, send the
      //      formatted text so the user still has the data.
      //
      // Every layer down emits an internal alert so we can track
      // degradation without losing the consulta itself.
      const text = buildWhatsAppText(apiResponse, placaClean, icv5Result, rodizio, seguroEstimado, cotacaoUrl)

      // Always try to prefetch the chart bytes — used by both A and B.
      let chartDataUri: string | null = null
      if (chartUrl) {
        try {
          const buf = await $fetch<ArrayBuffer>(chartUrl, {
            responseType: 'arrayBuffer',
            timeout: 12_000,
          })
          chartDataUri = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
        } catch (err: any) {
          console.warn('[whatsapp] chart prefetch failed:', err?.message)
        }
      }

      // ----- Layer A: render the same email HTML to PNG via Gotenberg -----
      // Reuses buildEmailHtml so the WhatsApp image is visually identical
      // to the email a user would otherwise receive.
      let cardDataUri: string | null = null
      if (config.gotenbergUrl || process.env.GOTENBERG_URL) {
        const emailHtml = buildEmailHtml(apiResponse, placaClean, chartDataUri, icv5Result, rodizio, seguroEstimado, cotacaoUrl)
        const renderRes = await renderHtmlToPng(emailHtml, { width: 560, timeoutMs: 15_000 })
        if (renderRes.ok && renderRes.bytes) {
          cardDataUri = `data:image/png;base64,${renderRes.bytes.toString('base64')}`
        } else {
          console.warn(
            '[whatsapp] gotenberg render failed:',
            renderRes.status,
            renderRes.error,
            'durationMs=' + renderRes.durationMs,
          )
          await sendErrorEmail({
            endpoint: '/api/consulta (whatsapp card render)',
            errorMessage: `Gotenberg render failed (status ${renderRes.status}): ${renderRes.error}. Will fall back to chart-only.`,
            requestBody: { placa: placaClean, phone: normalizedPhone, gotenbergStatus: renderRes.status, durationMs: renderRes.durationMs },
            userAgent,
            ip,
            timestamp: new Date().toISOString(),
          })
        }
      }

      const primaryMedia = cardDataUri || chartDataUri || chartUrl
      const primaryCaption = cardDataUri ? `Consulta ${placaClean} - placacompleta.com.br` : text

      let result = primaryMedia
        ? await sendWhatsAppImage(normalizedPhone as string, primaryMedia, primaryCaption)
        : await sendWhatsAppText(normalizedPhone as string, text)

      if (!result.ok && chartUrl) {
        console.warn('[whatsapp] image send failed, falling back to text:', result.status, result.error, result.rawResponse)
        const fallback = await sendWhatsAppText(normalizedPhone as string, text)
        if (fallback.ok) {
          whatsappSent = true
          // Image delivery is degraded — alert internally even though
          // the user got the data.
          await sendErrorEmail({
            endpoint: '/api/consulta (whatsapp image fallback)',
            errorMessage: `Image send failed (status ${result.status}), text fallback OK. Evolution body: ${result.rawResponse?.slice(0, 300)}`,
            requestBody: { placa: placaClean, phone: normalizedPhone, hadChart: true, attempts: result.attempts },
            userAgent,
            ip,
            timestamp: new Date().toISOString(),
          })
        } else {
          result = fallback
        }
      } else if (result.ok) {
        whatsappSent = true
      }

      if (!whatsappSent) {
        console.error('Evolution API error:', result.status, result.error, result.rawResponse)
        await sendErrorEmail({
          endpoint: '/api/consulta (whatsapp sending)',
          errorMessage: `Failed to send WhatsApp (status ${result.status}): ${result.error}. Evolution body: ${result.rawResponse?.slice(0, 300)}`,
          requestBody: { placa: placaClean, phone: normalizedPhone, hadChart: Boolean(chartUrl), attempts: result.attempts },
          userAgent,
          ip,
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  const supabase = useSupabaseServer()
  await registrarConsulta(supabase, {
    id: consultaId,
    email: sanitizedEmail,
    phone: normalizedPhone,
    placa: placaClean,
    ip_address: ip,
    geo_city: ipGeo?.city ?? null,
    geo_uf: ipGeo?.uf ?? null,
    geo_country: ipGeo?.country ?? null,
    geo_region_code: regiao?.code ?? null,
    ...trafego,
    user_agent: userAgent,
    device_info: deviceInfo,
    is_pwa: isPWA || false,
    channel,
    email_sent: emailSent,
    whatsapp_sent: whatsappSent,
    api_response: apiResponse,
  }, 'web')

  let message: string
  if (isPWA) {
    message = 'Consulta realizada.'
  } else if (channel === 'tela') {
    message = 'Consulta realizada.'
  } else if (channel === 'whatsapp') {
    message = whatsappSent
      ? 'Consulta realizada! Verifique seu WhatsApp.'
      : 'Consulta realizada, mas houve um erro ao enviar pelo WhatsApp. Tente novamente.'
  } else {
    message = emailSent
      ? 'Consulta realizada! Verifique seu e-mail.'
      : 'Consulta realizada, mas houve um erro ao enviar o e-mail. Tente novamente.'
  }

  // Valor FIPE ATUAL (so o numero, sem o historico/grafico — esse segue pago).
  // Melhor match por score no payload da wdapi, mesmo criterio do valor-custo.
  const fipeLista = apiResponse?.fipe?.dados
  const fipeMelhor = Array.isArray(fipeLista) && fipeLista.length
    ? fipeLista.reduce((b: any, i: any) => ((i?.score || 0) > (b?.score || 0) ? i : b), fipeLista[0])
    : null
  const fipeValorAtual = fipeMelhor?.texto_valor || null

  return {
    success: true,
    channel,
    emailSent,
    whatsappSent,
    message,
    data: isPWA ? apiResponse : undefined,
    fipeHistory: isPWA ? fipeHistoryPoints : undefined,
    seguroEstimado: !isPWA ? seguroEstimado : undefined,
    // Bloco livre mostrado NA TELA na web (o "o que e o carro"). E o mesmo
    // conjunto que a consulta gratis sempre entregou por e-mail — nada aqui
    // vem do SENATRAN, que so roda depois do pagamento.
    basico: !isPWA ? {
      placa: placaClean,
      marca: apiResponse.MARCA || apiResponse.marca || null,
      modelo: apiResponse.MODELO || apiResponse.modelo || null,
      ano: apiResponse.extra?.ano_modelo || apiResponse.anoModelo || apiResponse.ano || null,
      anoFabricacao: apiResponse.extra?.ano_fabricacao || apiResponse.ano || null,
      cor: apiResponse.cor || apiResponse.COR || null,
      combustivel: apiResponse.extra?.combustivel || null,
      // Nacional ou importado. Muda revenda, seguro e preco de peca, entao vale
      // como isca; nao entrega nada que so o cadastro pago tem.
      // O bloco `extra` nao vem pra toda placa (QZZ1I96, por exemplo, chega
      // com extra: null); quando falta, a origem existe no topo do payload.
      origem: apiResponse.extra?.nacionalidade || apiResponse.origem || null,
      // Municipio do PRIMEIRO EMPLACAMENTO (nao a jurisdicao atual — esse dado
      // e do SENATRAN, so no relatorio pago). Complementar, nao duplica nada
      // que a gratis ja mostrava.
      municipio: apiResponse.municipio || null,
      uf: apiResponse.uf || null,
      // So o comeco do chassi: confere com o do documento sem entregar o
      // numero, que e do relatorio pago.
      chassiParcial: mascararChassi(apiResponse.extra?.chassi),
      // Valor FIPE atual (referencia de mercado). So o valor corrente; o
      // historico/grafico continua sendo conteudo pago.
      fipe: fipeValorAtual,
    } : undefined,
    // payload minimo pro botao de compartilhar no WhatsApp (web)
    // Sem FIPE: virou conteudo pago, e o texto de compartilhamento e superficie
    // publica.
    share: !isPWA ? {
      marca: apiResponse.MARCA || apiResponse.marca || '',
      modelo: apiResponse.MODELO || apiResponse.modelo || '',
      ano: apiResponse.anoModelo || apiResponse.ano || '',
    } : undefined,
  }
})

/**
 * Normaliza o price_history da FIPE API em pontos ordenados e downsampled
 * ({label: 'Jan/25', price: 28799}), prontos pra renderizar como barras.
 * Mesma logica de selecao/downsample usada pelo chart do e-mail.
 */
function buildHistoryPoints(historyData: any, anoModelo: string | number): { label: string; price: number }[] | null {
  if (!historyData?.price_history?.length) return null

  const anoStr = String(anoModelo)
  let entries = historyData.price_history.find((h: any) => String(h.year) === anoStr)
  if (!entries) entries = historyData.price_history[0]
  if (!entries?.prices?.length) return null

  const sorted = [...entries.prices].sort((a: any, b: any) => {
    const da = new Date(a.year, a.month - 1)
    const db = new Date(b.year, b.month - 1)
    return da.getTime() - db.getTime()
  })

  const MAX_POINTS = 8 // tela de celular comporta menos barras que o e-mail
  let downsampled = sorted
  if (sorted.length > MAX_POINTS) {
    const step = (sorted.length - 1) / (MAX_POINTS - 1)
    downsampled = Array.from({ length: MAX_POINTS }, (_, i) => sorted[Math.round(i * step)])
  }

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const points = downsampled
    .filter((h: any) => typeof h.price === 'number' && h.price > 0)
    .map((h: any) => ({
      label: `${months[h.month - 1]}/${String(h.year).slice(2)}`,
      price: h.price,
    }))
  return points.length > 1 ? points : null
}

function buildChartUrl(historyData: any, anoModelo: string | number, textoModelo: string): string | null {
  if (!historyData?.price_history?.length) return null

  const anoStr = String(anoModelo)
  // Find matching year-model or fallback to first
  let entries = historyData.price_history.find((h: any) => String(h.year) === anoStr)
  if (!entries) entries = historyData.price_history[0]
  if (!entries?.prices?.length) return null

  // Sort chronologically (oldest → newest)
  const sorted = [...entries.prices].sort((a: any, b: any) => {
    const da = new Date(a.year, a.month - 1)
    const db = new Date(b.year, b.month - 1)
    return da.getTime() - db.getTime()
  })

  // Downsample to at most 10 points, always including oldest and most recent
  const MAX_POINTS = 10
  let downsampled = sorted
  if (sorted.length > MAX_POINTS) {
    const step = (sorted.length - 1) / (MAX_POINTS - 1)
    downsampled = Array.from({ length: MAX_POINTS }, (_, i) => sorted[Math.round(i * step)])
  }

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const labels = downsampled.map((h: any) => `${months[h.month - 1]}/${String(h.year).slice(2)}`)
  const values = downsampled.map((h: any) => h.price)

  // Compute a "nice" Y-axis stepSize targeting ~5 ticks
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1
  const rawStep = range / 5
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / magnitude
  const yStep = norm < 1.5 ? magnitude : norm < 3 ? 2 * magnitude : norm < 7 ? 5 * magnitude : 10 * magnitude

  const chartConfigStr = `{
    type:'line',
    data:{
      labels:${JSON.stringify(labels)},
      datasets:[{
        data:${JSON.stringify(values)},
        borderColor:'#3066be',
        backgroundColor:'rgba(48,102,190,0.1)',
        fill:true,
        pointRadius:4,
        pointBackgroundColor:'#3066be',
        borderWidth:2,
        tension:0.3,
        datalabels:{
          display:true,
          align:function(ctx){return ctx.dataIndex===0?'right':'top'},
          color:'#333',
          font:{size:10,weight:'bold'},
          formatter:function(v){return 'R$'+(v/1000).toFixed(1)+'k'}
        }
      }]
    },
    options:{
      legend:{display:false},
      plugins:{
        datalabels:{display:true}
      },
      layout:{padding:{top:25,left:0,right:5}},
      scales:{
        yAxes:[{
          ticks:{fontColor:'#666',stepSize:${yStep},fontSize:10,callback:function(value,index,values){return 'R$'+(value/1000).toFixed(1)+'k'}},
          gridLines:{color:'#e0e0e0'}
        }],
        xAxes:[{
          ticks:{fontColor:'#666',maxRotation:45},
          gridLines:{display:false}
        }]
      }
    }
  }`

  const encoded = encodeURIComponent(chartConfigStr)
  const chartOnly = `https://quickchart.io/chart?w=480&h=250&bkg=white&c=${encoded}`
  const logoUrl = 'https://placacompleta.com.br/logo-horizontal-600.png'

  return `https://quickchart.io/watermark?mainImageUrl=${encodeURIComponent(chartOnly)}&markImageUrl=${encodeURIComponent(logoUrl)}&markRatio=0.3&position=center&opacity=0.15&margin=0&imageWidth=480`
}

interface SpRodizio {
  day: string
  digits: string
}

function getSpRodizioInfo(placa: string): SpRodizio | null {
  const lastDigit = placa.slice(-1)
  const map: Record<string, SpRodizio> = {
    '1': { day: 'Segunda-feira', digits: '1 e 2' },
    '2': { day: 'Segunda-feira', digits: '1 e 2' },
    '3': { day: 'Terça-feira', digits: '3 e 4' },
    '4': { day: 'Terça-feira', digits: '3 e 4' },
    '5': { day: 'Quarta-feira', digits: '5 e 6' },
    '6': { day: 'Quarta-feira', digits: '5 e 6' },
    '7': { day: 'Quinta-feira', digits: '7 e 8' },
    '8': { day: 'Quinta-feira', digits: '7 e 8' },
    '9': { day: 'Sexta-feira', digits: '9 e 0' },
    '0': { day: 'Sexta-feira', digits: '9 e 0' },
  }
  return map[lastDigit] || null
}

function buildEmailHtml(data: Record<string, any>, placa: string, chartUrl: string | null = null, icv5: ICV5Result | null = null, rodizio: SpRodizio | null = null, seguro: SeguroEstimado | null = null, cotacaoUrl: string | null = null): string {
  // Fields from the upstream wdapi2 payload must be HTML-escaped before
  // interpolation — a compromised or hostile upstream could otherwise
  // inject script-bearing markup into the email body.
  const marca = escapeHtml(data.MARCA || data.marca || '-')
  const modelo = escapeHtml(data.MODELO || data.modelo || '-')
  const ano = escapeHtml(data.ano || '-')
  const anoModelo = escapeHtml(data.anoModelo || '-')
  const cor = escapeHtml(data.cor || '-')
  const municipio = escapeHtml(data.municipio || '-')
  const uf = escapeHtml(data.uf || '-')
  const situacao = escapeHtml(data.situacao || '-')
  const origem = escapeHtml(data.origem || '-')
  const chassi = escapeHtml(data.extra?.chassi || data.chassi || '-')

  const extra = data.extra || {}
  const combustivel = escapeHtml(extra.combustivel || '-')
  const especie = escapeHtml(extra.especie || '-')
  const tipoVeiculo = escapeHtml(extra.tipo_veiculo || '-')
  const passageiros = escapeHtml(extra.quantidade_passageiro || '-')

  // Find FIPE entry with highest score (best match)
  const fipeData = data.fipe?.dados?.reduce((max: any, item: any) =>
    (item.score > (max?.score || 0)) ? item : max
  , null)
  const fipeValor = escapeHtml(fipeData?.texto_valor || '-')
  const fipeModelo = escapeHtml(fipeData?.texto_modelo || '-')
  const fipeRef = escapeHtml(fipeData?.mes_referencia || '-')

  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const fipeExtra = chartUrl ? `
    <tr>
      <td colspan="2" style="padding:14px 12px;text-align:center;background:#ffffff;border-top:1px solid #e3e7ef;border-radius:0 0 12px 12px;">
        <img src="${chartUrl}" alt="Histórico FIPE" width="420" style="width:100%;max-width:420px;height:auto;display:block;margin:0 auto;border:1px solid #dde3ee;border-radius:8px;" />
        <p style="font-size:11px;color:#7d8597;margin:8px 0 0;font-family:'Segoe UI',Arial,sans-serif;">Evolução do preço nos últimos meses</p>
      </td>
    </tr>
  ` : ''

  const rodizioDisclaimer = `
    <tr>
      <td colspan="2" style="padding:10px 14px;font-size:11px;color:#5c677d;line-height:1.45;background:#f5f7fa;border-top:1px solid #e3e7ef;border-radius:0 0 12px 12px;font-family:'Segoe UI',Arial,sans-serif;font-style:italic;">
        Restrição válida apenas no Centro Expandido de SP capital, dias úteis.
        Isentos: veículos elétricos, táxis, motos, ônibus, ambulâncias e veículos de deficientes.
      </td>
    </tr>
  `

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }
    u + .body, body { color-scheme: light !important; }
  </style>
</head>
<body class="body" style="margin:0;padding:0;background-color:#001233;color-scheme:light;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#001233" style="padding:16px 8px;background-color:#001233;">
    <tr><td align="center">

      ${emailWindow(`Dados do Veículo - ${placa}`, `
        ${emailRow('Placa', placa)}
        ${emailRow('Marca', marca)}
        ${emailRow('Modelo', modelo)}
        ${emailRow('Ano Fab.', ano)}
        ${emailRow('Ano Modelo', anoModelo)}
        ${emailRow('Cor', cor)}
        ${emailRow('Combustível', combustivel)}
        ${emailRow('Tipo', tipoVeiculo)}
        ${emailRow('Espécie', especie)}
        ${emailRow('Passageiros', passageiros)}
        ${emailRow('Chassi', chassi)}
        ${emailRow('Município', `${municipio} - ${uf}`)}
        ${emailRow('Origem', origem)}
        ${emailRow('Situação', situacao, true)}
      `)}

      ${cotacaoUrl ? emailSeguroSection(seguro, cotacaoUrl) : ''}

      ${emailShareButton(marca, modelo, anoModelo, placa)}

      ${fipeValor !== '-' ? emailWindow('Tabela FIPE', `
        ${emailRow('Modelo FIPE', fipeModelo)}
        ${emailRow('Valor', fipeValor)}
        ${emailRow('Referência', fipeRef, !chartUrl)}
        ${fipeExtra}
      `) : ''}

      ${rodizio ? emailWindow('Rodízio Municipal - São Paulo Capital', `
        ${emailRow('Final da placa', placa.slice(-1))}
        ${emailRow('Dia do rodízio', rodizio.day)}
        ${emailRow('Finais restritos', rodizio.digits)}
        ${emailRow('Horário', '7h às 10h e 17h às 20h', true)}
        ${rodizioDisclaimer}
      `) : ''}

      ${icv5 ? emailWindow(`ICV5 - Custo para Manter em 5 Anos em ${icv5.uf}`, `
        ${emailRow('Manutenção anual', formatBRL(icv5.manutencaoAnual))}
        ${emailRow('Manutenção 5 anos', formatBRL(icv5.manutencao5anos))}
        ${emailRow('IPVA anual', formatBRL(icv5.ipvaAnual))}
        ${emailRow('IPVA 5 anos', formatBRL(icv5.ipva5anos))}
        ${emailRow('Custo total 5 anos', formatBRL(icv5.custoTotal5anos))}
        ${emailRow('Índice ICV5', `${icv5.indiceIcv5}% - ${icv5.classificacao}`, true)}
      `) : ''}

      <p style="font-size:11px;color:#979dac;text-align:center;font-family:'Segoe UI',Arial,sans-serif;margin:6px 0 0;max-width:520px;">
        Consulta realizada em ${timestamp} &nbsp;|&nbsp; placacompleta.com.br
      </p>

    </td></tr>
  </table>
</body>
</html>`
}

// Botao verde de compartilhar no WhatsApp: texto pronto com o veiculo +
// link do site. O wa.me so aceita TEXTO (nao anexa imagem) - o link
// clicavel e o que traz a consulta nova.
function emailShareButton(marca: string, modelo: string, ano: string, placa: string): string {
  const texto = encodeURIComponent(
    `Consultei a placa ${placa} no PlacaCompleta: ${marca} ${modelo} ${ano}. ` +
    `Consulta gratis com FIPE e seguro medio: https://placacompleta.com.br`
  )
  // contexto: dentro do <td> central do email (irmao das janelas), entao
  // o botao e uma table standalone, nao um <tr> solto
  return `
      <table cellpadding="0" cellspacing="0" style="margin:4px auto 18px;"><tr>
        <td bgcolor="#25D366" style="border-radius:8px;">
          <a href="https://wa.me/?text=${texto}" target="_blank"
             style="display:inline-block;padding:10px 24px;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
            Compartilhar no WhatsApp
          </a>
        </td>
      </tr></table>`
}

// Secao de seguro do email: estimativa SUSEP (quando ha) + botao de
// cotacao real linkando /cotacao?c=<uuid da consulta>. Sempre presente
// (versao generica sem estimativa) por decisao de produto.
function emailSeguroSection(seguro: SeguroEstimado | null, cotacaoUrl: string): string {
  const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  const botao = (label: string) => `
    <tr><td colspan="2" style="padding:14px 16px 6px;text-align:center;background:#ffffff;">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
        <td bgcolor="#0466c8" style="border-radius:8px;">
          <a href="${cotacaoUrl}" target="_blank"
             style="display:inline-block;padding:11px 28px;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
            ${label}
          </a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td colspan="2" style="padding:4px 16px 12px;text-align:center;background:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#7d8597;">
      Estimativa com base em dados oficiais SUSEP, corrigida pelo IPCA. Não substitui cotação de seguradora.
    </td></tr>`

  if (seguro) {
    return emailWindow('Seguro do seu carro', `
      ${emailRow('Seguro médio anual', fmt(seguro.premioAnual))}
      ${emailRow('Franquia média', fmt(seguro.franquia))}
      ${seguro.regiaoDoUsuario ? emailRow('Região', seguro.regiao.descricao, true) : ''}
      ${botao('Pedir cotação real →')}
    `)
  }
  return emailWindow('Seguro do seu carro', `
    <tr><td colspan="2" style="padding:14px 16px 2px;text-align:center;background:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#33415c;">
      Quer saber quanto custa segurar esse carro? Peça uma cotação gratuita.
    </td></tr>
    ${botao('Pedir cotação →')}
  `)
}

function emailWindow(title: string, bodyRowsHtml: string): string {
  const titleBarBg = "background:#0466c8;background-image:linear-gradient(180deg,#0466c8 0%,#0353a4 100%);"
  const btnStyle = "background:#2a82d8;color:#ffffff;border-radius:6px;font-size:10px;font-weight:bold;font-family:'Segoe UI',Arial,sans-serif;"
  const closeStyle = "background:#d65a4e;color:#ffffff;border-radius:6px;font-size:10px;font-weight:bold;font-family:'Segoe UI',Arial,sans-serif;"

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;margin:0 auto 12px;background:#ffffff;border-collapse:separate;border-spacing:0;border-radius:12px;">
  <tr>
    <td colspan="2" bgcolor="#0466c8" style="${titleBarBg}padding:9px 10px 9px 14px;border-radius:12px 12px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#ffffff;font-size:13px;font-weight:600;font-family:'Segoe UI',Arial,Helvetica,sans-serif;letter-spacing:0.3px;">${title}</td>
          <td align="right" width="76">
            <table cellpadding="0" cellspacing="0"><tr>
              <td width="20" height="18" align="center" bgcolor="#2a82d8" style="${btnStyle}">_</td>
              <td width="4">&nbsp;</td>
              <td width="20" height="18" align="center" bgcolor="#2a82d8" style="${btnStyle}">&#9633;</td>
              <td width="4">&nbsp;</td>
              <td width="20" height="18" align="center" bgcolor="#d65a4e" style="${closeStyle}">&times;</td>
            </tr></table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${bodyRowsHtml}
</table>`
}

function emailRow(label: string, value: string, isLast: boolean = false): string {
  const borderBottom = isLast ? '' : 'border-bottom:1px solid #e3e7ef;'
  const radiusLabel = isLast ? 'border-radius:0 0 0 12px;' : ''
  const radiusValue = isLast ? 'border-radius:0 0 12px 0;' : ''
  return `<tr>
    <td style="font-weight:600;color:#33415c;width:42%;padding:8px 14px;${borderBottom}${radiusLabel}background:#f5f7fa;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;">${label}</td>
    <td style="color:#0353a4;padding:8px 14px;${borderBottom}${radiusValue}background:#ffffff;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-weight:700;font-size:12px;">${value}</td>
  </tr>`
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Plain-text version of the consulta payload, formatted for WhatsApp.
// Uses *bold* and _italic_ markdown that WhatsApp renders natively.
// Wdapi2 fields are untrusted, but text-only output cannot inject markup,
// so escapeHtml is not required here.
function buildWhatsAppText(
  data: Record<string, any>,
  placa: string,
  icv5: ICV5Result | null = null,
  rodizio: SpRodizio | null = null,
  seguro: SeguroEstimado | null = null,
  cotacaoUrl: string | null = null,
): string {
  const marca = data.MARCA || data.marca || '-'
  const modelo = data.MODELO || data.modelo || '-'
  const ano = data.ano || '-'
  const anoModelo = data.anoModelo || '-'
  const cor = data.cor || '-'
  const municipio = data.municipio || '-'
  const uf = data.uf || '-'
  const situacao = data.situacao || '-'
  const chassi = data.extra?.chassi || data.chassi || '-'
  const extra = data.extra || {}
  const combustivel = extra.combustivel || '-'
  const tipoVeiculo = extra.tipo_veiculo || '-'

  const fipeData = data.fipe?.dados?.reduce(
    (max: any, item: any) => ((item.score || 0) > (max?.score || 0) ? item : max),
    null,
  )
  const fipeValor = fipeData?.texto_valor || null
  const fipeModelo = fipeData?.texto_modelo || null

  const lines: string[] = [
    `*PlacaCompleta — ${placa}*`,
    '',
    `*Veículo*`,
    `Marca:        ${marca}`,
    `Modelo:       ${modelo}`,
    `Ano fab/mod:  ${ano}/${anoModelo}`,
    `Cor:          ${cor}`,
    `Combustível:  ${combustivel}`,
    `Tipo:         ${tipoVeiculo}`,
    `Chassi:       ${chassi}`,
    `Município:    ${municipio} - ${uf}`,
    `Situação:     ${situacao}`,
  ]

  if (fipeValor) {
    lines.push('', '*Tabela FIPE*')
    if (fipeModelo) lines.push(`Modelo:  ${fipeModelo}`)
    lines.push(`Valor:   ${fipeValor}`)
  }

  if (rodizio) {
    lines.push(
      '',
      '*Rodízio SP*',
      `Dia:           ${rodizio.day}`,
      `Finais:        ${rodizio.digits}`,
      `Horário:       7h-10h e 17h-20h`,
    )
  }

  if (icv5) {
    lines.push(
      '',
      `*ICV5 — Custo 5 anos em ${icv5.uf}*`,
      `Manutenção:    ${formatBRL(icv5.manutencao5anos)}`,
      `IPVA:          ${formatBRL(icv5.ipva5anos)}`,
      `Total:         ${formatBRL(icv5.custoTotal5anos)}`,
      `Índice ICV5:   ${icv5.indiceIcv5}% (${icv5.classificacao})`,
    )
  }

  if (cotacaoUrl) {
    lines.push('')
    if (seguro) {
      const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
      lines.push('*Seguro do seu carro*', `Seguro médio: ${fmt(seguro.premioAnual)}/ano (franquia ${fmt(seguro.franquia)})`)
    } else {
      lines.push('*Seguro do seu carro*', 'Quer saber quanto custa segurar esse carro?')
    }
    lines.push(`Peça uma cotação real: ${cotacaoUrl}`)
  }

  lines.push('', '_placacompleta.com.br_')
  return lines.join('\n')
}
