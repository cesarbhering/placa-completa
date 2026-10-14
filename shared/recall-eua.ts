// Recall nos EUA (NHTSA) para chassi da America do Norte (infra #544,
// snapshot.recallEua). Informativo: e campanha do mercado americano para o
// modelo e ano, NAO confirmacao para este carro. Aqui so o formato e saneado;
// texto do resumo fica em ingles, como vem.

export const ROTULO_RECALL_EUA = 'Campanhas de recall nos EUA para este modelo e ano (informativo; confirme com a montadora no Brasil)'

export interface CampanhaEua { numero: string; componente: string; resumo: string; data: string | null }
export interface RecallEuaTela {
  rotulo: string
  marca: string
  modelo: string
  ano: number | null
  campanhas: CampanhaEua[]
}

/** 'dd/mm/aaaa', 'aaaa-mm-dd...' -> 'dd/mm/aaaa'; outra coisa -> null. */
export function dataEua(v: unknown): string | null {
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[1]}/${m[2]}/${m[3]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return null
}

const txt = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** null quando nao ha campo ou nao ha campanha (o card nao aparece). */
export function sanearRecallEua(bruto: unknown): RecallEuaTela | null {
  const r: any = bruto
  if (!r || typeof r !== 'object' || !Array.isArray(r.campanhas)) return null
  const campanhas = r.campanhas
    .filter((c: any) => c && typeof c === 'object' && txt(c.numero, 40))
    .slice(0, 20)
    .map((c: any) => ({ numero: txt(c.numero, 40), componente: txt(c.componente, 120), resumo: txt(c.resumo, 400), data: dataEua(c.data) }))
  if (!campanhas.length) return null
  const ano = parseInt(String(r.ano ?? ''), 10)
  return { rotulo: txt(r.rotulo, 200) || ROTULO_RECALL_EUA, marca: txt(r.marca, 60), modelo: txt(r.modelo, 80), ano: Number.isFinite(ano) ? ano : null, campanhas }
}

/** "Componente" legivel: a NHTSA manda caixa alta com ':' ("AIR BAGS:FRONTAL"). */
export function componenteEua(c: string): string {
  return c ? c.split(':').map((x) => x.trim()).filter(Boolean).join(' · ') : 'Componente não informado'
}
