/**
 * Captura a origem de trafego (gclid do Google Ads auto-tagging + utm_*)
 * na primeira pagina visitada e persiste em sessionStorage - o usuario
 * pode aterrissar em /tabela-fipe-por-placa e so consultar depois na home.
 * O POST /api/consulta le daqui e grava na linha da consulta.
 */
export default defineNuxtPlugin(() => {
  try {
    const params = new URLSearchParams(window.location.search)
    const origin: Record<string, string> = {}
    for (const key of ['gclid', 'utm_source', 'utm_medium', 'utm_campaign']) {
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
