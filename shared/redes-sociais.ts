// Perfis oficiais do PlacaCompleta (rodape e sameAs do schema Organization).
export const REDES_SOCIAIS = [
  { nome: 'LinkedIn', url: 'https://www.linkedin.com/company/placacompleta/', label: 'PlacaCompleta no LinkedIn' },
  { nome: 'X', url: 'https://x.com/PlacaCompleta', label: 'PlacaCompleta no X' },
  { nome: 'TikTok', url: 'https://www.tiktok.com/@placacompleta/', label: 'TikTok do PlacaCompleta' },
] as const

export const SAME_AS = REDES_SOCIAIS.map((r) => r.url)
