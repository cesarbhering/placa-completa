// Logo de montadora vindo da apiplacas (campo "logo" do payload da consulta,
// ex.: https://apiplacas.com.br/logos/logosMarcas/jac.png). Fallback do
// MarcaLogo quando a marca nao tem path na simple-icons nem na nossa base.
//
// Seguranca: o relatorio NUNCA aponta pro dominio deles (CSP img-src nao
// permite, e o relatorio nao pode depender do site de terceiro). A tela recebe
// so o caminho do NOSSO proxy (/api/logo-marca/<arquivo>), e o proxy so busca
// em https://apiplacas.com.br/logos/logosMarcas/, com nome de arquivo
// validado, PNG de verdade e tamanho maximo.

const HOST = 'apiplacas.com.br'
const PASTA = '/logos/logosMarcas/'
/** Nome do arquivo: letras, digitos e ponto interno ("m.benz.png"); sem barra, sem "..". */
const ARQUIVO_OK = /^[a-z0-9](?:[a-z0-9]|\.(?!\.))*\.png$/

export function arquivoLogoValido(arquivo: unknown): arquivo is string {
  return typeof arquivo === 'string' && arquivo.length <= 60 && ARQUIVO_OK.test(arquivo)
}

/** URL da apiplacas -> caminho do nosso proxy. Qualquer outra coisa: null. */
export function logoProxyDe(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (u.protocol !== 'https:' || u.hostname !== HOST || u.port || u.search || u.hash) return null
  if (!u.pathname.startsWith(PASTA)) return null
  const arquivo = u.pathname.slice(PASTA.length).toLowerCase()
  // "i.png"/"imp.png": a fonte leu o prefixo de importado ("I/GWM ...") como
  // marca (THX8888, 22/out/2026). Nao e logo de montadora.
  if (/^(i|imp|import)\.png$/.test(arquivo)) return null
  return arquivoLogoValido(arquivo) ? `/api/logo-marca/${arquivo}` : null
}

export function urlOrigemLogo(arquivo: string): string {
  return `https://${HOST}${PASTA}${arquivo}`
}
