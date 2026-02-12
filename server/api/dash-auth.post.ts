export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password } = body

  if (!password) {
    throw createError({
      statusCode: 400,
      message: 'Senha não fornecida',
    })
  }

  // Get password from environment variable
  const correctPassword = process.env.DASHBOARD_LOOKER_GOOGLE_ANALYTICS

  if (!correctPassword) {
    throw createError({
      statusCode: 500,
      message: 'Configuração de senha não encontrada',
    })
  }

  // Simple string comparison
  const isValid = password === correctPassword

  return {
    success: isValid,
    message: isValid ? 'Acesso autorizado' : 'Senha incorreta',
  }
})
