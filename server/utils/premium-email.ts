import { textoCupomRecompra } from './cupom-recompra'
import { PLANOS, isPlanoPago } from '../../shared/planos'

// E-mail de entrega do relatorio premium. E a unica copia DURAVEL do link: a
// aba pode fechar, o historico local vive so naquele navegador, e o token e a
// credencial. Se este e-mail nao chegar, a pessoa pagou e ficou sem acesso.
//
// HTML de e-mail e outro bicho: tabela em vez de flex, estilo inline em vez de
// classe, largura fixa em vez de media query. Cliente de e-mail nao e
// navegador.

type Entrega = {
  email: string | null
  token: string
  plano?: string | null
  placa?: string | null
  /** Cupom de recompra (so entra no e-mail com NUXT_CUPOM_RECOMPRA_EMAIL=on). */
  cupom?: { codigo: string; validoAte: string } | null
}

const NAVY = '#0B1F3A'
const AZUL = '#1f6feb'
const TINTA = '#1a1a1a'
const GRAFITE = '#636363'
const FIO = '#e8e8e8'
const FONTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// "Relatorio completo" e masculino, "Consulta basica" e feminino. Sem isto o
// assunto do plano basico saia "Seu consulta basica esta pronto".
const GENERO = {
  completa: { seu: 'Seu', o: 'O', pronto: 'pronto' },
  basica: { seu: 'Sua', o: 'A', pronto: 'pronta' },
} as const

function planoDe(plano?: string | null): 'basica' | 'completa' {
  return isPlanoPago(plano) ? plano : 'completa'
}

function nomeDoPlano(plano?: string | null): string {
  return PLANOS[planoDe(plano)].nome
}

function montarHtml(link: string, plano?: string | null, placa?: string | null, cupomTexto?: string | null): string {
  const nome = nomeDoPlano(plano)
  const g = GENERO[planoDe(plano)]
  // O historico de leilao e exclusivo da completa: prometer isso no e-mail da
  // basica seria vender o que a pessoa nao comprou.
  const ehCompleta = planoDe(plano) === 'completa'
  const daPlaca = placa ? ` da placa <strong style="color:${TINTA}">${placa}</strong>` : ''
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${nome} pronto</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;">
  <!-- Preheader: o trecho que aparece na lista antes de abrir. Escondido no corpo. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${g.seu} ${nome.toLowerCase()}${placa ? ` da placa ${placa}` : ''} está ${g.pronto}. O link está aqui dentro.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${FIO};border-radius:16px;overflow:hidden;">

          <tr>
            <td align="center" style="padding:28px 24px 20px;border-bottom:1px solid ${FIO};">
              <img src="https://placacompleta.com.br/logo-horizontal-600.png" width="180" height="72" alt="PlacaCompleta" style="display:block;border:0;width:180px;height:auto;">
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:32px 32px 8px;font-family:${FONTE};text-align:center;">
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;font-weight:600;color:${TINTA};text-align:center;">
                ${g.seu} ${nome.toLowerCase()} está ${g.pronto}.
              </h1>
              <!-- Duas frases, duas linhas: juntas viravam um bloco que a
                   pessoa le em diagonal e nao registra a placa. -->
              <p style="margin:0 0 8px;font-size:16px;line-height:1.5;color:${GRAFITE};text-align:center;">
                A consulta${daPlaca} foi concluída.
              </p>
              <p style="margin:0;font-size:16px;line-height:1.5;color:${GRAFITE};text-align:center;">
                ${g.o} <strong style="color:${TINTA}">${nome}</strong> está no link abaixo.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <!-- Botao em tabela: o Outlook ignora padding em <a>. -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${AZUL}" style="border-radius:4px;">
                    <a href="${link}" style="display:inline-block;padding:16px 32px;font-family:${FONTE};font-size:14px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:4px;">
                      Ver meu relatório
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 32px;font-family:${FONTE};">
              ${ehCompleta ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${GRAFITE};text-align:center;">
                Inclui o histórico de leilão: a placa e o chassi deste veículo foram cruzados com uma base de mais de 1 milhão de veículos leiloados.
              </p>` : ''}
              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${GRAFITE};text-align:center;">
                Guarde este e-mail. O link é o seu acesso ao relatório, e ele não expira.
              </p>
              ${cupomTexto ? `<p style="margin:0 0 16px;padding:12px 14px;font-size:14px;line-height:1.5;color:${TINTA};text-align:center;background:#f7f7f7;border-radius:8px;">
                Vai ver outro carro? ${cupomTexto}
              </p>` : ''}
              <p style="margin:0;font-size:12px;line-height:1.5;color:${GRAFITE};text-align:center;word-break:break-all;">
                Se o botão não funcionar, copie e cole no navegador:<br>
                <a href="${link}" style="color:${AZUL};text-decoration:underline;">${link}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 32px;background:${NAVY};font-family:${FONTE};">
              <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#ffffff;font-weight:600;">
                Precisa de ajuda?
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.75);">
                Escreva para
                <a href="mailto:contato@placacompleta.com.br" style="color:#ffffff;text-decoration:underline;">contato@placacompleta.com.br</a>
              </p>
            </td>
          </tr>

        </table>

        <p style="margin:16px 0 0;font-family:${FONTE};font-size:12px;line-height:1.5;color:${GRAFITE};">
          PlacaCompleta · consulta veicular por placa
        </p>

      </td>
    </tr>
  </table>
</body>
</html>`
}

function montarTexto(link: string, plano?: string | null, placa?: string | null, cupomTexto?: string | null): string {
  const nome = nomeDoPlano(plano)
  const g = GENERO[planoDe(plano)]
  return [
    `${g.seu} ${nome.toLowerCase()} está ${g.pronto}.`,
    '',
    `A consulta${placa ? ` da placa ${placa}` : ''} foi concluída.`,
    `${g.o} ${nome} está neste link:`,
    link,
    '',
    'Guarde este e-mail. O link é o seu acesso ao relatório, e ele não expira.',
    '',
    ...(cupomTexto ? [`Vai ver outro carro? ${cupomTexto}`, ''] : []),
    'Precisa de ajuda? Escreva para contato@placacompleta.com.br',
    '',
    'PlacaCompleta · consulta veicular por placa',
  ].join('\n')
}

// ----------------------------------------------------------------------------
// E-mail de ESTORNO pro cliente: quando o pagamento foi feito, a consulta falhou
// e o estorno automatico DEU CERTO. Avisa quem pagou que o dinheiro volta, com o
// prazo certo por meio de pagamento. Transacional (mesmo Resend/remetente da
// entrega) e fail-open: erro no envio nunca muda status nem derruba o fluxo.

type Estorno = {
  email: string | null
  placa?: string | null
  valorCentavos?: number | null
  /** 'cartao' muda a frase do prazo; qualquer outra coisa (default) = Pix. */
  formaPagamento?: string | null
}

/**
 * So avisa o cliente quando o estorno automatico deu certo E o pedido tem
 * e-mail. Puro de proposito: e o ponto testavel de "envia no ok, nao envia sem
 * e-mail, nao envia no reembolso falho".
 */
export function deveAvisarClienteEstorno(reembolsoOk: boolean, email: string | null | undefined): boolean {
  return !!reembolsoOk && !!email
}

function reaisEstorno(centavos?: number | null): string {
  if (!centavos || centavos <= 0) return 'o valor pago'
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`
}

function ehCartao(forma?: string | null): boolean {
  return String(forma || '').toLowerCase() === 'cartao'
}

function estornoLinhaPrazo(forma?: string | null): string {
  return ehCartao(forma)
    ? 'O estorno aparece na fatura do cartão em até 10 dias úteis, conforme o banco emissor.'
    : 'O valor volta para a mesma conta de onde saiu o pagamento.'
}

function montarHtmlEstorno(placa: string, valor: string, forma?: string | null): string {
  const via = ehCartao(forma) ? 'cartão' : 'Pix'
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reembolso da consulta ${placa}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Reembolsamos integralmente ${valor} da consulta da placa ${placa}.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${FIO};border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 24px 20px;border-bottom:1px solid ${FIO};">
              <img src="https://placacompleta.com.br/logo-horizontal-600.png" width="180" height="72" alt="PlacaCompleta" style="display:block;border:0;width:180px;height:auto;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:${FONTE};">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TINTA};">Olá,</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${GRAFITE};">
                Não conseguimos gerar o relatório completo da placa <strong style="color:${TINTA}">${placa}</strong> por uma instabilidade nos servidores que consultamos. Por isso reembolsamos integralmente os <strong style="color:${TINTA}">${valor}</strong> pagos via ${via}.
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:${GRAFITE};">
                ${estornoLinhaPrazo(forma)}
              </p>
              <p style="margin:0 0 4px;font-size:15px;line-height:1.5;color:${GRAFITE};">
                Pedimos desculpas pelo transtorno. Quando quiser, é só consultar a placa de novo em
                <a href="https://placacompleta.com.br" style="color:${AZUL};text-decoration:underline;">placacompleta.com.br</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px;background:${NAVY};font-family:${FONTE};">
              <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#ffffff;font-weight:600;">Precisa de ajuda?</p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.75);">
                Escreva para <a href="mailto:contato@placacompleta.com.br" style="color:#ffffff;text-decoration:underline;">contato@placacompleta.com.br</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:${FONTE};font-size:12px;line-height:1.5;color:${GRAFITE};">
          Equipe PlacaCompleta
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function montarTextoEstorno(placa: string, valor: string, forma?: string | null): string {
  const via = ehCartao(forma) ? 'cartão' : 'Pix'
  return [
    'Olá,',
    '',
    `Não conseguimos gerar o relatório completo da placa ${placa} por uma instabilidade nos servidores que consultamos. Por isso reembolsamos integralmente os ${valor} pagos via ${via}.`,
    '',
    estornoLinhaPrazo(forma),
    '',
    'Pedimos desculpas pelo transtorno. Quando quiser, é só consultar a placa de novo em placacompleta.com.br.',
    '',
    'Equipe PlacaCompleta',
  ].join('\n')
}

export async function enviarEstornoEmail(estorno: Estorno): Promise<boolean> {
  const config = useRuntimeConfig()
  const { email } = estorno
  if (!config.resendApiKey || !email) return false

  const placa = String(estorno.placa || '').toUpperCase() || 'informada'
  const valor = reaisEstorno(estorno.valorCentavos)
  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: {
        from: 'PlacaCompleta <contato@placacompleta.com.br>',
        to: [email],
        reply_to: 'contato@placacompleta.com.br',
        subject: `Seu pagamento da consulta ${placa} foi reembolsado`,
        html: montarHtmlEstorno(placa, valor, estorno.formaPagamento),
        text: montarTextoEstorno(placa, valor, estorno.formaPagamento),
      },
    })
    return true
  } catch (e: any) {
    // Fail-open: o estorno JA aconteceu e o status ja e 'reembolsado'. Nao
    // avisar por e-mail e ruim, mas nao pode virar erro que derrube o fluxo.
    console.error('[premium-email] estorno: envio falhou:', email, String(e?.data?.message || e?.message || e))
    return false
  }
}

export async function enviarRelatorioEmail(entrega: Entrega): Promise<boolean> {
  const config = useRuntimeConfig()
  const { email, token, plano, placa } = entrega
  // Linha do cupom de recompra: so com NUXT_CUPOM_RECOMPRA_EMAIL=on (o texto
  // muda um e-mail que vai pro cliente e precisa do ok antes de ligar).
  const cupomTexto = entrega.cupom && String(config.cupomRecompraEmail || '') === 'on' ? textoCupomRecompra(entrega.cupom) : null
  if (!config.resendApiKey || !email) return false

  const link = `${config.premiumBaseUrl}/premium/${token}`
  const nome = nomeDoPlano(plano)
  const g = GENERO[planoDe(plano)]
  const assunto = placa
    ? `${g.seu} ${nome.toLowerCase()} da placa ${placa} está ${g.pronto}`
    : `${g.seu} ${nome.toLowerCase()} está ${g.pronto}`

  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: {
        from: 'PlacaCompleta <contato@placacompleta.com.br>',
        to: [email],
        // Regra do Cesar (01/out): e-mail a cliente sai de contato@, nunca de
        // noreply@; a resposta tambem cai em contato@.
        reply_to: 'contato@placacompleta.com.br',
        subject: assunto,
        html: montarHtml(link, plano, placa, cupomTexto),
        // Alternativa em texto: filtro de spam desconfia de e-mail so-HTML, e
        // cliente em modo texto ficaria sem o link.
        text: montarTexto(link, plano, placa, cupomTexto),
      },
    })
    return true
  } catch (e: any) {
    // Falhar aqui e a pessoa pagar e nao receber o acesso. Antes o catch era
    // vazio: ninguem ficava sabendo, nem ela nem nos.
    console.error('[premium-email] envio falhou:', email, String(e?.data?.message || e?.message || e))
    return false
  }
}
