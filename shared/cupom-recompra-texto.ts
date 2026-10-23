// Texto unico do cupom de recompra: faixa do relatorio e linha do e-mail.
// 20% ate 20/out/2026; 10% nos cupons gerados depois (decisao do Cesar). Os
// cupons ja emitidos seguem valendo o que foram: o texto usa o `pct` do cupom
// quando ele vem (cupons_premium.valor), e este numero so para os novos.
export const DESCONTO_RECOMPRA_PCT = 10

type CupomTexto = { codigo: string; validoAte: string; pct?: number | null }
/** Percentual do cupom (o gravado no cupom; sem ele, o atual). */
export function pctDoCupom(c: { pct?: number | null } | null | undefined): number {
  const p = Number(c?.pct)
  return Number.isFinite(p) && p > 0 && p < 100 ? p : DESCONTO_RECOMPRA_PCT
}

/** "12/10" no fuso de Brasilia. */
export function dataCurtaBr(iso: string): string {
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).formatToParts(new Date(iso))
  return `${p.find((x) => x.type === 'day')?.value}/${p.find((x) => x.type === 'month')?.value}`
}

export function textoCupomRecompra(c: CupomTexto): string {
  return `Use ${c.codigo} e ganhe ${pctDoCupom(c)}% na próxima consulta. Pode compartilhar com quem também está comprando carro. Válido até ${dataCurtaBr(c.validoAte)}.`
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

export function mensagemWhatsappRecompra(c: CupomTexto): string {
  return `Estou usando o PlacaCompleta para checar carro usado antes de comprar. Use o cupom ${c.codigo} e ganhe ${pctDoCupom(c)}% no relatório completo, até ${dataCurtaBr(c.validoAte)}: ${URL_INDICACAO_RECOMPRA}`
}

export function linkWhatsappRecompra(c: CupomTexto): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagemWhatsappRecompra(c))}`
}
