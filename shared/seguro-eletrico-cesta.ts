// Cesta das paginas /seguro/carro-eletrico (Cesar, 22/out/2026, opcao b): a
// cesta mistura eletricos (Leaf, Bolt, Zoe) e hibridos (Prius, Corolla Hybrid),
// que sao os modelos com apolices na base SUSEP. Hibrido NAO e eletrico (tem
// motor a combustao), entao a pagina diz o tipo de cada modelo.

export type TipoCesta = 'Elétrico' | 'Híbrido'

/** Tipo do modelo da cesta pelo nome ("Toyota Prius (híbrido)", "Toyota Corolla Hybrid"). */
export function tipoDoModeloCesta(nome: string): TipoCesta {
  return /h[ií]brid|hybrid/i.test(String(nome || '')) ? 'Híbrido' : 'Elétrico'
}

/** Nome sem o sufixo de tipo ("Nissan Leaf (elétrico)" -> "Nissan Leaf"); a coluna Tipo ja diz. */
export function nomeSemTipo(nome: string): string {
  return String(nome || '').replace(/\s*\((el[eé]trico|h[ií]brido)\)\s*$/i, '').trim()
}

/** Frase da composicao da cesta na UF. */
export function fraseComposicao(modelos: { nome: string }[]): string {
  const el = modelos.filter((m) => tipoDoModeloCesta(m.nome) === 'Elétrico').map((m) => nomeSemTipo(m.nome))
  const hi = modelos.filter((m) => tipoDoModeloCesta(m.nome) === 'Híbrido').map((m) => nomeSemTipo(m.nome))
  const lista = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0])
  const partes: string[] = []
  if (el.length) partes.push(`${el.length === 1 ? 'é 100% elétrico' : 'são 100% elétricos'}: ${lista(el)}`)
  if (hi.length) partes.push(`${hi.length === 1 ? 'é híbrido' : 'são híbridos'} (motor a combustão junto com o elétrico): ${lista(hi)}`)
  if (!el.length) return `Nesta região a base de apólices só tem híbridos, que não são carros elétricos: ${lista(hi)}. A média acima é desses híbridos.`
  return `Da cesta desta região, ${partes.join('; ')}.`
}
