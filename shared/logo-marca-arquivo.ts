// Arquivo do logo da montadora no nosso proxy (/api/logo-marca/<arquivo>),
// deduzido do nome da marca. Usado quando a fonte nao manda o campo "logo"
// (caso RMB6B90, BYD Song Plus: veio sem logo e saiu sem simbolo nenhum).
// O proxy so serve o que existir na apiplacas; se nao existir, a imagem falha
// e a tela mostra o monograma.

// Marcas cujo arquivo na apiplacas nao e o proprio nome.
const ARQUIVO_POR_MARCA: Record<string, string> = {
  GWM: 'greatwall',
  'GREAT WALL': 'greatwall',
  GREATWALL: 'greatwall',
  CAOA: 'caoachery',
  'CAOA CHERY': 'caoachery',
  CHERY: 'chery',
  BYD: 'byd',
  HAVAL: 'haval',
  GAC: 'gac',
  GEELY: 'geely',
  ZEEKR: 'zeekr',
  OMODA: 'omoda',
  JAECOO: 'jaecoo',
}

/** "BYD" -> "/api/logo-marca/byd.png". Token invalido: null. */
export function logoProxyDaMarca(marca: string | null | undefined): string | null {
  const m = String(marca || '').trim().toUpperCase()
  if (!m) return null
  const base = ARQUIVO_POR_MARCA[m] || m.toLowerCase()
  const arquivo = `${base}.png`
  // Mesma regra do proxy (server/utils/logo-marca.ts): letras, digitos e ponto
  // interno, sem barra e sem "..".
  if (arquivo.length > 60 || !/^[a-z0-9](?:[a-z0-9]|\.(?!\.))*\.png$/.test(arquivo)) return null
  return `/api/logo-marca/${arquivo}`
}
