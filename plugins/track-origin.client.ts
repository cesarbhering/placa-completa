/**
 * Captura a origem de trafego (gclid do Google Ads e msclkid do Microsoft
 * Ads, os dois de auto-tagging, mais utm_*)
 * na primeira pagina visitada e persiste em sessionStorage - o usuario
 * pode aterrissar em /tabela-fipe-por-placa e so consultar depois na home.
 * O POST /api/consulta le daqui e grava na linha da consulta.
 */
import { CAMPOS_ORIGEM } from '~/shared/origem-trafego'

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
})
