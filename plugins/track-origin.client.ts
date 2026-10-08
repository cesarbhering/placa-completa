/**
 * Captura a origem de trafego (gclid do Google Ads e msclkid do Microsoft
 * Ads, os dois de auto-tagging, mais utm_*)
 * na primeira pagina visitada e persiste em sessionStorage - o usuario
 * pode aterrissar em /tabela-fipe-por-placa e so consultar depois na home.
 * O POST /api/consulta le daqui e grava na linha da consulta.
 *
 * Clique em anuncio tambem fica 30 dias no localStorage: numa sessao nova sem
 * marca na URL, a origem volta com origem_retorno (ver shared/origem-trafego).
 */
import { CAMPOS_ORIGEM, referrerLimpo, pathLimpo, lembrarOrigem, origemLembrada } from '~/shared/origem-trafego'

export default defineNuxtPlugin(() => {
  try {
    const params = new URLSearchParams(window.location.search)
    const origin: Record<string, string> = {}
    for (const key of CAMPOS_ORIGEM) {
      const v = params.get(key)
      // oppref (OpenAI Ads) vai sem alteracao: nunca truncar.
      if (v) origin[key] = key === 'oppref' ? v : v.slice(0, 200)
    }
    if (Object.keys(origin).length) {
      sessionStorage.setItem('pc_origin', JSON.stringify(origin))
      try { lembrarOrigem(localStorage, origin) } catch { /* localStorage bloqueado */ }
    } else if (!sessionStorage.getItem('pc_origin')) {
      // Sessao nova sem marca na URL: recupera o clique em anuncio dos ultimos 30 dias.
      let lembrada: Record<string, string> | undefined
      try { lembrada = origemLembrada(localStorage) } catch { lembrada = undefined }
      if (lembrada) sessionStorage.setItem('pc_origin', JSON.stringify({ ...lembrada, origem_retorno: '1' }))
    }
  } catch {
    // sessionStorage indisponivel (modo privado antigo etc) - segue sem origem
  }
  // Pagina de entrada e referrer: SO no primeiro acesso da sessao (navegar
  // dentro do site nao sobrescreve). Ver shared/origem-trafego.ts.
  try {
    if (!sessionStorage.getItem('pc_entrada')) {
      sessionStorage.setItem('pc_entrada', JSON.stringify({
        referrer: referrerLimpo(document.referrer),
        landing_path: pathLimpo(window.location.pathname),
      }))
    }
  } catch {
    // idem
  }
})
