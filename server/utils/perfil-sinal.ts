import { marcaExibicao } from '../../shared/marca-exibicao'
import { UFS } from '../../shared/empresas'

// Atributos do veiculo para os dois sinais da consulta gratis (leilao e
// recall).
//
// O sinal de uma placa fica em cache por 24 h e e respondido a todo mundo que
// pergunta por ela, entao o que entra no calculo nao pode ser escolhido por
// quem chama. Os atributos saem do que o SERVIDOR ja guarda da placa
// (placa_cache, gravado pela consulta gratis), campo a campo, com as mesmas
// expressoes do bloco `basico` que a tela recebe (server/api/consulta.post.ts).
// O corpo da requisicao so preenche o campo que o servidor nao tem, com
// tamanho limitado e normalizado, e ai `doCorpo` vem true: o resultado e
// respondido so a quem chamou, sem ir para o cache.

export const TAM_MARCA = 60
export const TAM_MODELO = 120
export const TAM_COR = 40

export interface PerfilSinal {
  marca: string | null
  modelo: string | null
  /** Ano-modelo (a tela manda o mesmo valor em `ano` e `anoModelo`). */
  ano: string | null
  anoFab: string | null
  anoModelo: string | null
  cor: string | null
  uf: string | null
  /** Algum campo veio do corpo da requisicao: nao guardar o resultado em cache. */
  doCorpo: boolean
}

/** Texto curto: so string ou numero, sem caractere de controle, espacos colapsados, com teto. */
export function textoCurto(v: unknown, max: number): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim()
  return s || null
}

/** Ano com 4 digitos ("2020"), ou fabricacao/modelo ("2019/2020"). Outra coisa = null. */
export function anoCurto(v: unknown): string | null {
  // Teto folgado: texto mais longo que um ano nao pode virar ano no corte.
  const s = textoCurto(v, 12)
  return s && /^(19|20)\d{2}(\/(19|20)\d{2})?$/.test(s) ? s : null
}

/** Uma das 27 siglas, em maiusculas. Outra coisa = null. */
export function ufCurta(v: unknown): string | null {
  // Teto de 3 (e nao 2) pra "SPA" nao virar "SP" no corte.
  const s = textoCurto(v, 3)?.toUpperCase() ?? null
  return s && (UFS as readonly string[]).includes(s) ? s : null
}

/**
 * Monta o perfil: o campo do servidor quando ele existe, senao o do corpo.
 * `payload` e o que a consulta gratis guardou da placa (ou null).
 */
export function perfilDoSinal(payload: any, body: any): PerfilSinal {
  const p = payload && typeof payload === 'object' ? payload : null
  const b = body && typeof body === 'object' ? body : {}
  let doCorpo = false
  const escolher = (doServidor: string | null, doBody: string | null): string | null => {
    if (doServidor) return doServidor
    if (doBody) doCorpo = true
    return doBody
  }

  const marca = escolher(p ? textoCurto(marcaExibicao(p), TAM_MARCA) : null, textoCurto(b.marca, TAM_MARCA))
  const modelo = escolher(p ? textoCurto(p.MODELO || p.modelo, TAM_MODELO) : null, textoCurto(b.modelo, TAM_MODELO))
  const anoModeloServidor = p ? anoCurto(p.extra?.ano_modelo || p.anoModelo || p.ano) : null
  const ano = escolher(anoModeloServidor, anoCurto(b.ano))
  const anoModelo = escolher(anoModeloServidor, anoCurto(b.anoModelo))
  const anoFab = escolher(p ? anoCurto(p.extra?.ano_fabricacao || p.ano) : null, anoCurto(b.anoFab))
  const cor = escolher(p ? textoCurto(p.cor || p.COR, TAM_COR) : null, textoCurto(b.cor, TAM_COR))
  const uf = escolher(p ? ufCurta(p.uf) : null, ufCurta(b.uf))

  return { marca, modelo, ano, anoFab, anoModelo, cor, uf, doCorpo }
}
