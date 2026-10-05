// Codigo FIPE exibido no relatorio pago (pedido do Cesar, 04/out): o da MESMA
// versao que deu o valor mostrado. Snapshot novo grava valorCusto.fipeCodigo;
// nos antigos, o codigo vem da lista de candidatos, casando pelo modelo do
// valor (fipeModelo). Versao ambigua (a tela nao mostra valor) ou sem codigo:
// nada. Nunca reconsulta.

const FORMATO = /^\d{6}-\d$/

export function codigoFipeDoRelatorio(vc: any): string | null {
  if (!vc || !vc.fipe) return null
  const c = vc.fipeCandidato
  if (c && (c.decididoPor === 'ambiguo' || c.confianca === 'baixa')) return null
  const direto = String(vc.fipeCodigo || '').trim()
  if (FORMATO.test(direto)) return direto
  const modelo = String(vc.fipeModelo || '').trim().toLowerCase()
  if (!modelo || !Array.isArray(c?.candidatos)) return null
  const achados = c.candidatos.filter((x: any) => String(x?.modelo || '').trim().toLowerCase() === modelo && FORMATO.test(String(x?.codigo_fipe || '')))
  const codigos = [...new Set(achados.map((x: any) => String(x.codigo_fipe)))]
  return codigos.length === 1 ? codigos[0] as string : null
}
