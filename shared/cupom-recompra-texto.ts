// Texto unico do cupom de recompra: faixa do relatorio e linha do e-mail.
export const DESCONTO_RECOMPRA_PCT = 20

/** "12/10" no fuso de Brasilia. */
export function dataCurtaBr(iso: string): string {
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).formatToParts(new Date(iso))
  return `${p.find((x) => x.type === 'day')?.value}/${p.find((x) => x.type === 'month')?.value}`
}

export function textoCupomRecompra(c: { codigo: string; validoAte: string }): string {
  return `Use ${c.codigo} e ganhe ${DESCONTO_RECOMPRA_PCT}% na próxima consulta. Pode compartilhar com quem também está comprando carro. Válido até ${dataCurtaBr(c.validoAte)}.`
}

// Card do fim do relatorio (opcao 1 + botao de WhatsApp, escolha do Cesar 05/out).
// O link do WhatsApp nunca leva token nem placa: so o codigo, a validade e a
// home com UTM de indicacao.
export const URL_INDICACAO_RECOMPRA =
  'https://placacompleta.com.br/?utm_source=whatsapp&utm_medium=indicacao&utm_campaign=cupom_recompra'

/** "Vale para qualquer placa, até 12/10. Pode compartilhar." */
export function metaCupomRecompra(c: { validoAte: string }): string {
  return `Vale para qualquer placa, até ${dataCurtaBr(c.validoAte)}. Pode compartilhar.`
}

export function mensagemWhatsappRecompra(c: { codigo: string; validoAte: string }): string {
  return `Estou usando o PlacaCompleta para checar carro usado antes de comprar. Use o cupom ${c.codigo} e ganhe ${DESCONTO_RECOMPRA_PCT}% no relatório completo, até ${dataCurtaBr(c.validoAte)}: ${URL_INDICACAO_RECOMPRA}`
}

export function linkWhatsappRecompra(c: { codigo: string; validoAte: string }): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagemWhatsappRecompra(c))}`
}
