// Envia o link do relatorio premium por email (entrega duravel). Best-effort:
// nunca quebra o fluxo se falhar.
export async function enviarRelatorioEmail(email: string | null, token: string) {
  const config = useRuntimeConfig()
  if (!config.resendApiKey || !email) return
  const link = `${config.premiumBaseUrl}/premium/${token}`
  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: {
        from: 'PlacaCompleta <contato@placacompleta.com.br>',
        to: [email],
        subject: 'Sua consulta veicular completa está pronta',
        html: `<p>Olá! Sua consulta veicular completa está pronta.</p>
<p><a href="${link}">Ver o relatório completo</a></p>
<p>Guarde este link, ele é o seu acesso ao relatório.</p>
<p>PlacaCompleta</p>`,
      },
    })
  } catch {
    // ignora
  }
}
