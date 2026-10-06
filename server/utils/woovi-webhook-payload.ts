// Leitura do corpo do webhook da Woovi, isolada pra teste.
//
// 06/out: o registro do webhook era recusado ("precisa retornar 200"). O POST
// de teste da Woovi vem assim, como JSON string DUPLAMENTE codificado:
//   "{\"data_criacao\":\"...\",\"evento\":\"teste_webhook\",\"event\":\"OPENPIX:CHARGE_COMPLETED\"}"
// e com `event` de pagamento real. Lendo so `event || evento`, o teste parecia
// pagamento e, com assinatura presente, caia no 401.

/** JSON.parse que desembrulha string codificada duas vezes. Corpo invalido = {}. */
export function lerPayloadWoovi(raw: string): any {
  let v: any = raw
  for (let i = 0; i < 2 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v) } catch { return {} }
  }
  return v && typeof v === 'object' ? v : {}
}

/** Ping/teste se QUALQUER um dos campos de evento disser teste. Nao processa nada. */
export function ehPingWoovi(payload: any): boolean {
  const campos = [payload?.evento, payload?.event].map((x) => String(x || ''))
  return campos.some((c) => /test|teste|ping|validation|validacao/i.test(c))
}
