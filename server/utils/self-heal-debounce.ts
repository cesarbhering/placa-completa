// Debounce em memoria do processo pro self-heal do relatorio (recall/multas).
//
// O relatorio entregue e acessado/pollado varias vezes. Sem freio, cada acesso
// que visse o bloco vazio dispararia um run caro (browser-use no recall, worker
// DETRAN nas multas). Este debounce garante NO MAXIMO um disparo por chave numa
// janela (default 90s). Chave = `${tipo}:${placa}` -> recall e multas debouncam
// SEPARADO (recursos diferentes).
//
// Caveat: o Map vive no processo. Com 1 container de prod (hoje), resolve. Se um
// dia escalar pra N replicas, migrar pra um lock no banco (uma linha por
// chave+janela). Os freios de custo de verdade (podeGastar/TETO/MAX_TENTATIVAS
// dentro de buscarRecall/MultasDetalhe) valem por cima, checados ANTES do run
// caro -- entao mesmo se o debounce deixar passar, placa esgotado/acima do teto
// nao gasta.
const JANELA_PADRAO_MS = 90_000

const _ultimoDisparo = new Map<string, number>()

/**
 * True (e marca o disparo) se a chave nao disparou dentro da janela; false caso
 * contrario. `agora` e `mapa` sao injetaveis pro teste.
 */
export function podeReprocessar(
  chave: string,
  janelaMs: number = JANELA_PADRAO_MS,
  agora: number = Date.now(),
  mapa: Map<string, number> = _ultimoDisparo,
): boolean {
  const ultimo = mapa.get(chave)
  // Nunca disparou (ausente) -> passa. Ja disparou dentro da janela -> bloqueia.
  if (ultimo != null && agora - ultimo < janelaMs) return false
  mapa.set(chave, agora)
  return true
}
