import { Resend } from 'resend'
import { isValidEmail, isValidPlate, isValidPhone, sanitizeEmail } from '../utils/validation'
import { calcularICV5, inferirCategoria, type ICV5Result } from '../utils/icv5'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { email, phone, placa, isPWA, includeFipeChart, includeIcv5, icv5Uf } = body

  if (!email || !placa) {
    throw createError({ statusCode: 400, message: 'E-mail e placa são obrigatórios.' })
  }

  // Validate email format
  if (!isValidEmail(email)) {
    throw createError({ statusCode: 400, message: 'E-mail inválido.' })
  }

  // Validate phone if provided
  if (phone && !isValidPhone(phone)) {
    throw createError({ statusCode: 400, message: 'Telefone inválido.' })
  }

  // Sanitize email to prevent injection + normalize case for consistent dedupe
  const sanitizedEmail = sanitizeEmail(email).toLowerCase()

  const headers = getRequestHeaders(event)
  const ip = headers['x-forwarded-for']?.split(',')[0]?.trim()
    || headers['x-real-ip']
    || 'unknown'
  const userAgent = headers['user-agent'] || 'unknown'

  const placaClean = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
  if (!placaRegex.test(placaClean)) {
    throw createError({ statusCode: 400, message: 'Formato de placa inválido.' })
  }

  const isMobile = /mobile|android|iphone/i.test(userAgent)
  const deviceInfo = isMobile ? 'Mobile' : 'Desktop'

  // Dedupe: if the same email already received this placa in the last hour,
  // skip the paid API call + Resend and inform the user the email was already sent.
  // Non-PWA only — PWA returns data inline, not via email.
  if (!isPWA) {
    const supabase = useSupabaseServer()
    const { data: existing, error: dedupeError } = await supabase
      .from('consultas')
      .select('created_at')
      .eq('email', sanitizedEmail)
      .eq('placa', placaClean)
      .eq('email_sent', true)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dedupeError) {
      console.warn('[dedupe] Supabase error:', dedupeError.message)
    }

    if (existing) {
      const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(existing.created_at).getTime()) / 60000))
      return {
        success: true,
        emailSent: true,
        message: `Você já consultou essa placa há ${minutesAgo === 1 ? 'menos de 1 minuto' : `${minutesAgo} min`}. O e-mail com os dados foi enviado para ${sanitizedEmail} — verifique sua caixa de entrada e a pasta de spam.`,
      }
    }
  }

  let apiResponse = null
  let emailSent = false

  try {
    const apiUrl = `https://wdapi2.com.br/consulta/${placaClean}/${config.placaApiToken}`
    const apiResult = await $fetch<Record<string, any>>(apiUrl)
    apiResponse = apiResult
  } catch (err: any) {
    // Send error email
    await sendErrorEmail({
      endpoint: '/api/consulta',
      errorMessage: err?.message || 'Erro ao consultar API de placas',
      errorStack: err?.stack,
      requestBody: { placa: placaClean, isPWA },
      userAgent,
      ip,
      timestamp: new Date().toISOString(),
    })

    const supabase = useSupabaseServer()
    await supabase.from('consultas').insert({
      email: sanitizedEmail,
      phone: phone || null,
      placa: placaClean,
      ip_address: ip,
      user_agent: userAgent,
      device_info: deviceInfo,
      is_pwa: isPWA || false,
      email_sent: false,
      api_response: null,
    })
    throw createError({ statusCode: 502, message: 'Erro ao consultar dados da placa. Tente novamente.' })
  }

  if (apiResponse?.codigoRetorno === 0 || apiResponse?.mensagemRetorno === 'Sem erros.') {
    // noop - success
  } else if (apiResponse?.MARCA || apiResponse?.marca) {
    // also valid response
  } else {
    const supabase = useSupabaseServer()
    await supabase.from('consultas').insert({
      email: sanitizedEmail,
      phone: phone || null,
      placa: placaClean,
      ip_address: ip,
      user_agent: userAgent,
      device_info: deviceInfo,
      is_pwa: isPWA || false,
      email_sent: false,
      api_response: apiResponse,
    })
    throw createError({ statusCode: 404, message: 'Placa não encontrada ou sem dados disponíveis.' })
  }

  // Fetch FIPE price history for chart (best-effort)
  let chartUrl: string | null = null
  if (!isPWA && includeFipeChart !== false) {
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
          chartUrl = buildChartUrl(historyData?.data || historyData, apiResponse.anoModelo, bestFipe.texto_modelo)
        }
      }
    } catch (err) {
      // Non-critical — email will be sent without chart
      console.warn('Failed to fetch FIPE history for chart:', err)
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

  // Skip email sending for PWA mode
  if (!isPWA) {
    try {
      const resend = new Resend(config.resendApiKey)
      const rodizio = icv5Uf === 'SP' ? getSpRodizioInfo(placaClean) : null
      const htmlEmail = buildEmailHtml(apiResponse, placaClean, chartUrl, icv5Result, rodizio)

      await resend.emails.send({
        from: 'PlacaCompleta <consulta@placacompleta.com.br>',
        to: sanitizedEmail,
        subject: `PlacaCompleta - Consulta Veicular ${placaClean}`,
        html: htmlEmail,
      })
      emailSent = true
    } catch (err: any) {
      console.error('Resend error:', err)

      // Send error notification
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
  }

  const supabase = useSupabaseServer()
  await supabase.from('consultas').insert({
    email: sanitizedEmail,
    phone: phone || null,
    placa: placaClean,
    ip_address: ip,
    user_agent: userAgent,
    device_info: deviceInfo,
    is_pwa: isPWA || false,
    email_sent: emailSent,
    api_response: apiResponse,
  })

  return {
    success: true,
    emailSent,
    message: emailSent
      ? 'Consulta realizada! Verifique seu e-mail.'
      : 'Consulta realizada, mas houve um erro ao enviar o e-mail. Tente novamente.',
    data: isPWA ? apiResponse : undefined,
  }
})

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
  const logoUrl = 'https://placacompleta.com.br/logo-nobg-200.png'

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

function buildEmailHtml(data: Record<string, any>, placa: string, chartUrl: string | null = null, icv5: ICV5Result | null = null, rodizio: SpRodizio | null = null): string {
  const marca = data.MARCA || data.marca || '-'
  const modelo = data.MODELO || data.modelo || '-'
  const ano = data.ano || '-'
  const anoModelo = data.anoModelo || '-'
  const cor = data.cor || '-'
  const municipio = data.municipio || '-'
  const uf = data.uf || '-'
  const situacao = data.situacao || '-'
  const origem = data.origem || '-'
  const chassi = data.chassi || '-'

  const extra = data.extra || {}
  const combustivel = extra.combustivel || '-'
  const especie = extra.especie || '-'
  const tipoVeiculo = extra.tipo_veiculo || '-'
  const passageiros = extra.quantidade_passageiro || '-'

  // Find FIPE entry with highest score (best match)
  const fipeData = data.fipe?.dados?.reduce((max: any, item: any) =>
    (item.score > (max?.score || 0)) ? item : max
  , null)
  const fipeValor = fipeData?.texto_valor || '-'
  const fipeModelo = fipeData?.texto_modelo || '-'
  const fipeRef = fipeData?.mes_referencia || '-'

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px;">
    <tr><td align="center">

      <table width="480" cellpadding="0" cellspacing="0" style="background:#c0c0c0;border:2px solid;border-color:#fff #404040 #404040 #fff;">
        <!-- Title Bar -->
        <tr>
          <td style="background:linear-gradient(90deg,#000080,#3066be);color:#fff;padding:4px 8px;font-size:14px;font-weight:bold;">
            Consulta Veicular - ${placa}
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:16px;">
            <p style="font-size:14px;margin:0 0 12px;color:#3c3744;">
              Resultado da consulta para a placa <strong style="color:#090c9b;">${placa}</strong>:
            </p>

            <!-- Data Table -->
            <table width="100%" cellpadding="6" cellspacing="0" style="background:#fff;border:2px solid;border-color:#404040 #fff #fff #404040;font-size:13px;">
              <tr style="background:#3066be;">
                <td colspan="2" style="font-weight:bold;color:#fff;padding:8px;">Dados do Veículo</td>
              </tr>
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
              ${emailRow('Situação', situacao)}
            </table>

            ${fipeValor !== '-' ? `
            <table width="100%" cellpadding="6" cellspacing="0" style="background:#fff;border:2px solid;border-color:#404040 #fff #fff #404040;font-size:13px;margin-top:12px;">
              <tr style="background:#3066be;">
                <td colspan="2" style="font-weight:bold;color:#fff;padding:8px;">Tabela FIPE</td>
              </tr>
              ${emailRow('Modelo FIPE', fipeModelo)}
              ${emailRow('Valor', fipeValor)}
              ${emailRow('Referência', fipeRef)}
              ${chartUrl ? `
              <tr>
                <td colspan="2" style="padding:8px;text-align:center;">
                  <img src="${chartUrl}" alt="Histórico FIPE" width="420" style="width:100%;max-width:420px;height:auto;display:block;margin:0 auto;" />
                  <p style="font-size:11px;color:#3c3744;margin:6px 0 0;">Evolução do preço nos últimos meses</p>
                </td>
              </tr>
              ` : ''}
            </table>
            ` : ''}

            ${rodizio ? `
            <table width="100%" cellpadding="6" cellspacing="0" style="background:#fff;border:2px solid;border-color:#404040 #fff #fff #404040;font-size:13px;margin-top:12px;">
              <tr style="background:#3066be;">
                <td colspan="2" style="font-weight:bold;color:#fff;padding:8px;">Rodízio Municipal - São Paulo Capital</td>
              </tr>
              ${emailRow('Final da placa', placa.slice(-1))}
              ${emailRow('Dia do rodízio', rodizio.day)}
              ${emailRow('Finais restritos', rodizio.digits)}
              ${emailRow('Horário', '7h às 10h e 17h às 20h')}
              <tr>
                <td colspan="2" style="padding:8px;font-size:11px;color:#3c3744;line-height:1.4;">
                  Restrição válida apenas no Centro Expandido de SP capital, dias úteis.
                  Isentos: veículos elétricos, táxis, motos, ônibus, ambulâncias e veículos de deficientes.
                </td>
              </tr>
            </table>
            ` : ''}

            ${icv5 ? `
            <table width="100%" cellpadding="6" cellspacing="0" style="background:#fff;border:2px solid;border-color:#404040 #fff #fff #404040;font-size:13px;margin-top:12px;">
              <tr style="background:#3066be;">
                <td colspan="2" style="font-weight:bold;color:#fff;padding:8px;">ICV5 - Custo para Manter em 5 Anos em ${icv5.uf}</td>
              </tr>
              ${emailRow('Manutenção anual', formatBRL(icv5.manutencaoAnual))}
              ${emailRow('Manutenção 5 anos', formatBRL(icv5.manutencao5anos))}
              ${emailRow('IPVA anual', formatBRL(icv5.ipvaAnual))}
              ${emailRow('IPVA 5 anos', formatBRL(icv5.ipva5anos))}
              ${emailRow('Custo total 5 anos', formatBRL(icv5.custoTotal5anos))}
              ${emailRow('Índice ICV5', `${icv5.indiceIcv5}% - ${icv5.classificacao}`)}
            </table>
            ` : ''}

            <!-- Statusbar -->
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:16px;border:2px solid;border-color:#404040 #fff #fff #404040;background:#c0c0c0;font-size:12px;color:#3c3744;">
              <tr>
                <td>Consulta realizada em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} | placacompleta.com.br</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`
}

function emailRow(label: string, value: string): string {
  return `<tr style="border-bottom:1px dotted #808080;">
    <td style="font-weight:600;color:#3c3744;width:40%;padding:6px;border-bottom:1px dotted #ddd;">${label}</td>
    <td style="font-weight:700;color:#090c9b;padding:6px;border-bottom:1px dotted #ddd;">${value}</td>
  </tr>`
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
