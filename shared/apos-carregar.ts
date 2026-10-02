// Agenda uma tag de terceiro logo DEPOIS do evento load, sem depender de
// requestIdleCallback. O Safari do iOS nao tem requestIdleCallback e o
// fallback antigo era setTimeout(2500) contado do mount: o Clarity so subia
// ~3,7 s depois da navegacao no iPhone, e quem saia antes nao virava sessao
// (Clarity mostrava 33% de celular contra 67% no GSC). Depois do load o script
// async nao disputa o caminho critico; o rIC (quando existe) so ganha um teto
// curto.
export function aposCarregar(fn: () => void, w: any = typeof window !== 'undefined' ? window : undefined): void {
  if (!w) return
  let feito = false
  const rodar = () => { if (feito) return; feito = true; fn() }
  const agendar = () => {
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(rodar, { timeout: 1000 })
    else w.setTimeout(rodar, 200)
  }
  if (w.document?.readyState === 'complete') agendar()
  else w.addEventListener('load', agendar, { once: true })
}
