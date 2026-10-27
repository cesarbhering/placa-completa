// Recall NHTSA (EUA) para veiculos fabricados na America do Norte (Relatorio 2.0, decisao do Cesar 14/out/2026).
// - A NHTSA NAO expoe recall por VIN publicamente (recallsByVin = 403); so por marca + modelo + ano.
//   Por isso: vPIC (DecodeVinValues) traduz o VIN para marca/modelo/ano no padrao americano e
//   recallsByVehicle lista as campanhas daquele modelo/ano NOS EUA.
// - So roda quando o WMI comeca com 1-5 (EUA, Canada, Mexico). Fora disso: null (nao mostra nada).
// - Rotulo fixo e honesto: e campanha do mercado americano para o modelo/ano, nao confirmacao para ESTE carro.
// - Custo zero, sem chave. Cache 30 d por VIN no fonte_cache ('nhtsa', TTL em fonte-cache.ts). Fail-open: qualquer erro = null.
import { comFonteCache } from './fonte-cache'
import { registrarChamada } from './api-chamadas'

export const ROTULO_NHTSA = 'Campanhas de recall nos EUA para este modelo e ano (informativo; confirme com a montadora no Brasil)'
const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues'
const RECALLS = 'https://api.nhtsa.gov/recalls/recallsByVehicle'

export interface CampanhaNhtsa { numero: string; componente: string; resumo: string; data: string | null }
export interface RecallEua {
  fonte: 'nhtsa'
  rotulo: string
  marca: string
  modelo: string
  ano: number
  n_campanhas: number
  campanhas: CampanhaNhtsa[]
  consultadoEm?: string | null
}

export function fabricadoNaAmericaDoNorte(vin: string | null | undefined): boolean {
  const v = String(vin || '').trim().toUpperCase()
  return v.length === 17 && /^[1-5]/.test(v)
}

type Sb = { from: (t: string) => any }
type Opcoes = { sb?: Sb | null; fetcher?: (url: string, o?: any) => Promise<any>; timeoutMs?: number; anoModelo?: number | string | null }

// A letra do ano (10a posicao do VIN) repete a cada 30 anos e o vPIC desempata pela
// 7a posicao (digito = 1980-2009), regra que carro feito pro Brasil nao segue: o
// Jetta mexicano 2012 (3VWLN6162CM...) decodificava como 1982 e o relatorio
// mostrava recall de 1983 (caso FAN1I16, 27/out/2026). Com o ano modelo do
// SENATRAN o vPIC decodifica no ciclo certo; se ainda divergir, nao mostra nada.
function anoBrasil(v: unknown): number | null {
  const n = parseInt(String(v ?? ''), 10)
  return n >= 1950 && n <= 2100 ? n : null
}

async function buscar(vin: string, op: Opcoes): Promise<RecallEua | null> {
  const f = op.fetcher || ((url: string, o?: any) => $fetch<any>(url, o))
  const timeout = op.timeoutMs ?? 6000
  const t0 = Date.now()
  const anoBr = anoBrasil(op.anoModelo)
  const dec = await f(`${VPIC}/${vin}`, { query: anoBr ? { format: 'json', modelyear: anoBr } : { format: 'json' }, timeout })
  registrarChamada(op.sb ?? null, { fonte: 'nhtsa', caminho: '/vpic/DecodeVinValues/' + vin, code: 200, ms: Date.now() - t0 })
  const r = dec?.Results?.[0] || {}
  const marca = String(r.Make || '').trim()
  const modelo = String(r.Model || '').trim()
  const ano = parseInt(String(r.ModelYear || ''), 10)
  if (!marca || !modelo || !ano) return null
  if (anoBr && Math.abs(ano - anoBr) > 1) return null
  const t1 = Date.now()
  const rec = await f(RECALLS, { query: { make: marca, model: modelo, modelYear: ano }, timeout })
  registrarChamada(op.sb ?? null, { fonte: 'nhtsa', caminho: '/recalls/recallsByVehicle', code: 200, ms: Date.now() - t1 })
  const campanhas: CampanhaNhtsa[] = (Array.isArray(rec?.results) ? rec.results : [])
    .map((c: any) => ({
      numero: String(c.NHTSACampaignNumber || ''),
      componente: String(c.Component || '').slice(0, 120),
      resumo: String(c.Summary || '').replace(/\s+/g, ' ').trim().slice(0, 400),
      data: c.ReportReceivedDate ? String(c.ReportReceivedDate) : null,   // dd/mm/aaaa na API
    }))
    .filter((c: CampanhaNhtsa) => c.numero)
    .slice(0, 20)
  return { fonte: 'nhtsa', rotulo: ROTULO_NHTSA, marca, modelo, ano, n_campanhas: campanhas.length, campanhas }
}

/** null = nao se aplica (fora da America do Norte), sem dado ou falha. */
export async function consultarRecallEua(chassi: string | null | undefined, op: Opcoes = {}): Promise<RecallEua | null> {
  const vin = String(chassi || '').trim().toUpperCase()
  if (!fabricadoNaAmericaDoNorte(vin)) return null
  const sb = op.sb === undefined ? (() => { try { return useSupabaseServer() } catch { return null } })() : op.sb
  try {
    if (sb) {
      // chave com o ano: o cache antigo (so VIN) guardou ano errado do ciclo de 30 anos
      const anoBr = anoBrasil(op.anoModelo)
      const r = await comFonteCache(sb, 'nhtsa', anoBr ? `${vin}:${anoBr}` : vin, async () => {
        const b = await buscar(vin, { ...op, sb })
        return { status: b ? 'ok' : 'sem_dado', payload: b }
      })
      return r.status === 'ok' && r.payload ? { ...r.payload, consultadoEm: r.consultadoEm } : null
    }
    const b = await buscar(vin, op)
    return b ? { ...b, consultadoEm: new Date().toISOString() } : null
  } catch (e: any) {
    console.warn('[nhtsa] recall falhou (fail-open):', e?.message)
    return null
  }
}
