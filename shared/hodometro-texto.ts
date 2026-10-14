// Frase abaixo do extrato de quilometragem do relatorio (14/out, pedido do
// Cesar). Antes, sem regressao, a tela afirmava "Sem regressão de km. Sem
// indício de hodômetro adulterado." O extrato nao prova ausencia de
// adulteracao, entao, sem sinal, nao afirmamos nada sobre isso: damos uma
// orientacao de uso com a ultima leitura registrada. Com km menor que uma
// leitura anterior, o alerta vermelho continua igual.

export const ALERTA_HODOMETRO = 'Há registro de quilometragem menor que uma leitura anterior, possível adulteração.'

export function textoHodometro(a: {
  suspeito: boolean
  /** extrato em ordem cronologica, ja formatado (km "45.210", data "12/03/2025") */
  extrato: { km: string; data: string }[]
}): { tipo: 'alerta' | 'orientacao'; texto: string } | null {
  if (!a.extrato.length) return null
  if (a.suspeito) return { tipo: 'alerta', texto: ALERTA_HODOMETRO }
  const ultima = a.extrato[a.extrato.length - 1]
  const temKm = !!ultima.km && ultima.km !== '-'
  const ref = temKm
    ? `a última leitura registrada: ${ultima.km} km${ultima.data ? ` em ${ultima.data}` : ''}`
    : 'a última leitura registrada acima'
  return {
    tipo: 'orientacao',
    texto: `Compare a marcação atual do painel com ${ref}. Se o painel mostrar menos que isso, peça explicação ao vendedor antes de fechar.`,
  }
}
