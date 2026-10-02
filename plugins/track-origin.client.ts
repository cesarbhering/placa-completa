/**
 * Captura a origem de trafego (gclid do Google Ads e msclkid do Microsoft
 * Ads, os dois de auto-tagging, mais utm_*)
 * na primeira pagina visitada e persiste em sessionStorage - o usuario
 * pode aterrissar em /tabela-fipe-por-placa e so consultar depois na home.
 * O POST /api/consulta le daqui e grava na linha da consulta.
 */
import { CAMPOS_ORIGEM, referrerLimpo, pathLimpo } from '~/shared/origem-trafego'

export default defineNuxtPlugin(() => {
  try {
    const params = new URLSearchParams(window.location.search)
    const origin: Record<string, string> = {}
    for (const key of CAMPOS_ORIGEM) {
      const v = params.get(key)
      if (v) origin[key] = v.slice(0, 200)
    }
    if (Object.keys(origin).length) {
      sessionStorage.setItem('pc_origin', JSON.stringify(origin))
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
