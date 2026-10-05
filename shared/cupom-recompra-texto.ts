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
