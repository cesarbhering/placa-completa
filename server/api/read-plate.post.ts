export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { image } = body

  if (!image) {
    throw createError({ statusCode: 400, message: 'Imagem é obrigatória.' })
  }

  // Validate it's a base64 image
  if (!image.startsWith('data:image/')) {
    throw createError({ statusCode: 400, message: 'Formato de imagem inválido.' })
  }

  const headers = getRequestHeaders(event)
  const ip = headers['x-forwarded-for']?.split(',')[0]?.trim()
    || headers['x-real-ip']
    || 'unknown'
  const userAgent = headers['user-agent'] || 'unknown'

  try {
    // Call OpenAI Vision API
    const response = await $fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKeyOpenai}`
      },
      body: {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a license plate reader. Extract ONLY the license plate text from the image. Return ONLY the plate characters (letters and numbers) with no spaces, punctuation, or additional text. If you cannot read a plate, respond with "ERRO".'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Read the Brazilian license plate from this image. Return only the plate characters (example: ABC1D23 or ABC1234).'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        max_tokens: 50,
        temperature: 0
      }
    })

    const plateText = response.choices?.[0]?.message?.content?.trim().toUpperCase()

    if (!plateText || plateText === 'ERRO') {
      return {
        success: false,
        message: 'Não foi possível identificar a placa na foto. Tente tirar uma foto mais nítida.'
      }
    }

    // Clean the response (remove any extra characters)
    const cleanPlate = plateText.replace(/[^A-Z0-9]/g, '')

    // Validate Brazilian plate format
    const plateRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
    if (!plateRegex.test(cleanPlate)) {
      return {
        success: false,
        message: `Placa identificada (${cleanPlate}) não está em formato válido. Tente novamente.`
      }
    }

    return {
      success: true,
      placa: cleanPlate
    }
  } catch (err: any) {
    console.error('OpenAI API error:', err)

    // Send error notification
    await sendErrorEmail({
      endpoint: '/api/read-plate',
      errorMessage: err?.message || 'OpenAI API error',
      errorStack: err?.stack,
      requestBody: { imageSize: image?.length || 0 },
      userAgent,
      ip,
      timestamp: new Date().toISOString(),
    })

    // Check for specific error types
    if (err?.data?.error?.code === 'invalid_api_key') {
      throw createError({ statusCode: 500, message: 'Erro de configuração. Contate o suporte.' })
    }

    throw createError({
      statusCode: 502,
      message: 'Erro ao processar a imagem. Tente novamente.'
    })
  }
})
