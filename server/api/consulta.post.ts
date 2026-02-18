import { Resend } from 'resend'
import { isValidEmail, isValidPlate, isValidPhone, sanitizeEmail } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { email, phone, placa, isPWA } = body

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

  // Sanitize email to prevent injection
  const sanitizedEmail = sanitizeEmail(email)

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
  if (!isPWA) {
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

  // Skip email sending for PWA mode
  if (!isPWA) {
    try {
      const resend = new Resend(config.resendApiKey)
      const htmlEmail = buildEmailHtml(apiResponse, placaClean, chartUrl)

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
    email,
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

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const labels = sorted.map((h: any) => `${months[h.month - 1]}/${String(h.year).slice(2)}`)
  const values = sorted.map((h: any) => h.price)

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
          ticks:{fontColor:'#666',stepSize:500,fontSize:10,callback:function(value,index,values){return 'R$'+(value/1000).toFixed(1)+'k'}},
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

function buildEmailHtml(data: Record<string, any>, placa: string, chartUrl: string | null = null): string {
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

  const fipeData = data.fipe?.dados?.[0]
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
