import { isValidBase64Image } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { image } = body

  if (!image) {
    throw createError({ statusCode: 400, message: 'Imagem é obrigatória.' })
  }

  // Validate it's a base64 image
  // Validate base64 image format and size (max 5MB)
  if (!isValidBase64Image(image, 5)) {
    throw createError({ statusCode: 400, message: 'Formato de imagem inválido ou arquivo muito grande (máx. 5MB).' })
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
            content: `You are an expert Brazilian license plate reader. Your task is to extract ONLY the license plate text from images.

CRITICAL CHARACTER RECOGNITION RULES:
• Zero (0): Narrower, elongated shape with diagonal cut or slash. Appears ONLY in positions 4, 6, and 7.
• Letter O: Perfectly round and circular. Appears ONLY in positions 1, 2, 3, and 5 (Mercosul format).

BRAZILIAN PLATE FORMATS:
• Old format: ABC1234 (3 letters + 4 numbers) - Gray background, black characters
• Mercosul: ABC1D23 (3 letters + 1 number + 1 letter + 2 numbers) - White background, black characters, blue strip on top

RULES:
1. Return ONLY the plate characters (letters and numbers)
2. No spaces, punctuation, or additional text
3. Distinguish 0 from O based on POSITION and shape
4. If you cannot read the plate clearly, respond with "ERRO"

CRITICAL VALIDATION:
• If the plate has Mercosul color scheme (white background + blue strip), it MUST follow ABC1D23 format
• In Mercosul plates: If you see "O" in positions 4, 6, or 7 (numeric positions), interpret it as "0" (zero)
• In Mercosul plates: If you see "0" in positions 1, 2, 3, or 5 (letter positions), interpret it as "O" (letter)

Always double-check character positions before returning the result.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Read the Brazilian license plate from this image and return only the characters (example: ABC1D23 or ABC1234).'
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
