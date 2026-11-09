// Chassi na consulta GRATIS (tela, e-mail, WhatsApp e resposta do app): so a
// parte inicial. O numero inteiro e conteudo do relatorio pago (basica e
// completa) e fica so no servidor.

// Mostra parte do chassi e esconde o resto: o comprador confere contra o
// documento sem que a superficie gratis entregue o numero inteiro.
export function mascararChassi(chassi: unknown): string | null {
  const c = String(chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (c.length < 8) return null
  const visivel = c.slice(0, 5)
  return visivel + '*'.repeat(c.length - visivel.length)
}

// `extra` (com o chassi INTEIRO) nao vem pra toda placa — falta com frequencia
// em veiculo mais antigo (ex: Opala 1972 na placa GSZ6753). Quando falta, o
// payload raiz as vezes ja traz `chassi` PRE-MASCARADO PELA PROPRIA WDAPI, so
// que ao contrario do nosso padrao: esconde o COMECO e mostra o FINAL
// ("*****55388"). Rodar mascararChassi() em cima disso e o bug que fazia o
// campo sumir: a regex tira os "*" (nao sao alfanumericos), sobra so "55388"
// (5 chars), cai no guard de <8 e devolve null. Aqui so usamos o valor como
// veio quando ja mascarado — sem re-mascarar.
export function chassiParaExibicao(apiResponse: any): string | null {
  const completo = apiResponse?.extra?.chassi
  if (completo) return mascararChassi(completo)
  const bruto = apiResponse?.chassi
  if (typeof bruto !== 'string' || !bruto.trim()) return null
  // Raiz sem mascara nenhuma (chassi inteiro) tambem nao pode sair inteira.
  if (!bruto.includes('*')) return mascararChassi(bruto)
  return bruto.trim()
}

/**
 * Copia do payload pra sair da consulta gratis (resposta do app): chassi so na
 * forma parcial, em `extra.chassi` e na raiz. O inteiro fica no servidor
 * (placa_cache e a linha de `consultas`) e so aparece no relatorio pago.
 */
export function comChassiParcial<T>(apiResponse: T): T {
  if (!apiResponse || typeof apiResponse !== 'object') return apiResponse
  const p: any = apiResponse
  const parcial = chassiParaExibicao(p)
  const out: any = { ...p }
  if ('chassi' in p || parcial) out.chassi = parcial
  if (p.extra && typeof p.extra === 'object' && 'chassi' in p.extra) out.extra = { ...p.extra, chassi: parcial }
  return out as T
}
