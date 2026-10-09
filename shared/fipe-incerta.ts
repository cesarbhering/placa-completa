// Versao FIPE nao identificada com seguranca: a tela troca o valor pelo aviso
// e pela lista de versoes compativeis (acordeao com historico de cada uma).
//
// Alem de ambiguo/confianca baixa, conta o "nao localizado" com mais de uma
// versao na lista: a fonte veio sem FIPE, o juiz ficou em confianca media e o
// valor nao foi aceito (regra do FUG0A96). Caso TTR6F65 (Tracker T A): sem
// isto a tela dizia so "nao localizado" e escondia as 3 Tracker candidatas.
export function fipeEIncerta(vc: any): boolean {
  const c = vc?.fipeCandidato
  if (!c) return false
  if (c.decididoPor === 'ambiguo' || c.confianca === 'baixa') return true
  return !!vc?.fipeNaoLocalizado && !vc?.fipe && Array.isArray(c.candidatos) && c.candidatos.length > 1
}
