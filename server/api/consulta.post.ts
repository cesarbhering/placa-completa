import { Resend } from 'resend'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { email, phone, placa } = body

  if (!email || !placa) {
    throw createError({ statusCode: 400, message: 'E-mail e placa são obrigatórios.' })
  }

  const placaClean = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
  if (!placaRegex.test(placaClean)) {
    throw createError({ statusCode: 400, message: 'Formato de placa inválido.' })
  }

  const headers = getRequestHeaders(event)
  const ip = headers['x-forwarded-for']?.split(',')[0]?.trim()
    || headers['x-real-ip']
    || 'unknown'
  const userAgent = headers['user-agent'] || 'unknown'

  const isMobile = /mobile|android|iphone/i.test(userAgent)
  const deviceInfo = isMobile ? 'Mobile' : 'Desktop'

  let apiResponse = null
  let emailSent = false

  try {
    const apiUrl = `https://wdapi2.com.br/consulta/${placaClean}/${config.placaApiToken}`
    const apiResult = await $fetch<Record<string, any>>(apiUrl)
    apiResponse = apiResult
  } catch (err: any) {
    const supabase = useSupabaseServer()
    await supabase.from('consultas').insert({
      email,
      phone: phone || null,
      placa: placaClean,
      ip_address: ip,
      user_agent: userAgent,
      device_info: deviceInfo,
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
      email,
      phone: phone || null,
      placa: placaClean,
      ip_address: ip,
      user_agent: userAgent,
      device_info: deviceInfo,
      email_sent: false,
      api_response: apiResponse,
    })
    throw createError({ statusCode: 404, message: 'Placa não encontrada ou sem dados disponíveis.' })
  }

  try {
    const resend = new Resend(config.resendApiKey)
    const htmlEmail = buildEmailHtml(apiResponse, placaClean)

    await resend.emails.send({
      from: 'Placa Completa <consulta@placacompleta.com.br>',
      to: email,
      subject: `Consulta Veicular - Placa ${placaClean}`,
      html: htmlEmail,
    })
    emailSent = true
  } catch (err: any) {
    console.error('Resend error:', err)
  }

  const supabase = useSupabaseServer()
  await supabase.from('consultas').insert({
    email,
    phone: phone || null,
    placa: placaClean,
    ip_address: ip,
    user_agent: userAgent,
    device_info: deviceInfo,
    email_sent: emailSent,
    api_response: apiResponse,
  })

  return {
    success: true,
    emailSent,
    message: emailSent
      ? 'Consulta realizada! Verifique seu e-mail.'
      : 'Consulta realizada, mas houve um erro ao enviar o e-mail. Tente novamente.',
  }
})

function buildEmailHtml(data: Record<string, any>, placa: string): string {
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
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#c0c0c0;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#c0c0c0;padding:20px;">
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
              <tr style="background:#b4c5e4;">
                <td colspan="2" style="font-weight:bold;color:#090c9b;padding:8px;">Dados do Veículo</td>
              </tr>
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
              <tr style="background:#b4c5e4;">
                <td colspan="2" style="font-weight:bold;color:#090c9b;padding:8px;">Tabela FIPE</td>
              </tr>
              ${emailRow('Modelo FIPE', fipeModelo)}
              ${emailRow('Valor', fipeValor)}
              ${emailRow('Referência', fipeRef)}
            </table>
            ` : ''}

            <!-- Statusbar -->
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:16px;border:2px solid;border-color:#404040 #fff #fff #404040;background:#c0c0c0;font-size:11px;color:#3c3744;">
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
    <td style="color:#090c9b;padding:6px;border-bottom:1px dotted #ddd;">${value}</td>
  </tr>`
}
