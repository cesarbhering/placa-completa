/**
 * Compila dados de seguro (fipe-api / SUSEP corrigido por IPCA) pra uso
 * nas paginas pSEO. Roda manualmente e commita os JSONs gerados:
 *
 *   FIPE_API_URL=... FIPE_API_TOKEN=... npx tsx scripts/compile-seguro-data.ts
 *
 * Saidas em data/:
 *   seguro-eletricos.json  - cesta EV x 27 UFs (paginas /seguro/carro-eletrico)
 *   seguro-modelos.json    - todos os modelos da fipe-brands x 4 regioes
 *   seguro-estados.json    - cesta populares x 27 UFs + ranking das 41 regioes
 */
import { writeFileSync } from 'node:fs'
import { fipeBrands } from '../data/fipe-brands'

const BASE = process.env.FIPE_API_URL || ''
const TOKEN = process.env.FIPE_API_TOKEN || ''
if (!BASE || !TOKEN) {
  console.error('Defina FIPE_API_URL e FIPE_API_TOKEN')
  process.exit(1)
}
const HEADERS = { Authorization: `Bearer ${TOKEN}` }

// Regiao representativa por UF: metro da capital nos estados com split,
// codigo unico nos demais (tabela REGSUSEP - ver server/utils/regiao-susep.ts)
const UF_REGIAO: Record<string, { codigo: string; nome: string }> = {
  SP: { codigo: '11', nome: 'Grande São Paulo' },
  RJ: { codigo: '18', nome: 'Grande Rio de Janeiro' },
  MG: { codigo: '16', nome: 'Grande Belo Horizonte' },
  RS: { codigo: '01', nome: 'Grande Porto Alegre e Caxias' },
  PR: { codigo: '07', nome: 'Grande Curitiba' },
  SC: { codigo: '03', nome: 'Grande Florianópolis e Sul' },
  GO: { codigo: '39', nome: 'Goiás' },
  ES: { codigo: '20', nome: 'Espírito Santo' },
  BA: { codigo: '21', nome: 'Bahia' },
  SE: { codigo: '22', nome: 'Sergipe' },
  PE: { codigo: '23', nome: 'Pernambuco' },
  PB: { codigo: '24', nome: 'Paraíba' },
  RN: { codigo: '25', nome: 'Rio Grande do Norte' },
  AL: { codigo: '26', nome: 'Alagoas' },
  CE: { codigo: '27', nome: 'Ceará' },
  PI: { codigo: '28', nome: 'Piauí' },
  MA: { codigo: '29', nome: 'Maranhão' },
  PA: { codigo: '30', nome: 'Pará' },
  AM: { codigo: '31', nome: 'Amazonas' },
  AP: { codigo: '32', nome: 'Amapá' },
  RO: { codigo: '33', nome: 'Rondônia' },
  RR: { codigo: '34', nome: 'Roraima' },
  AC: { codigo: '35', nome: 'Acre' },
  MT: { codigo: '36', nome: 'Mato Grosso' },
  MS: { codigo: '37', nome: 'Mato Grosso do Sul' },
  DF: { codigo: '38', nome: 'Distrito Federal' },
  TO: { codigo: '40', nome: 'Tocantins' },
}

// Descricoes das 41 regioes REGSUSEP (pro ranking do blogpost)
const REGIOES_41: Record<string, string> = {
  '01': 'RS - Met. Porto Alegre e Caxias do Sul', '02': 'RS - Demais regiões',
  '03': 'SC - Met. Florianópolis e Sul', '04': 'SC - Oeste', '05': 'SC - Blumenau e demais regiões',
  '06': 'PR - Foz do Iguaçu-Medianeira-Cascavel-Toledo', '07': 'PR - Met. Curitiba', '08': 'PR - Demais regiões',
  '09': 'SP - Vale do Paraíba e Ribeira', '10': 'SP - Litoral Norte e Baixada Santista',
  '11': 'SP - Met. de São Paulo', '12': 'SP - Grande Campinas', '13': 'SP - Ribeirão Preto e demais municípios',
  '14': 'MG - Triângulo Mineiro', '15': 'MG - Sul', '16': 'MG - Met. BH-Centro Oeste-Zona da Mata',
  '17': 'MG - Vale do Aço-Norte-Jequitinhonha', '18': 'RJ - Met. do Rio de Janeiro', '19': 'RJ - Interior',
  '20': 'ES - Espírito Santo', '21': 'BA - Bahia', '22': 'SE - Sergipe', '23': 'PE - Pernambuco',
  '24': 'PB - Paraíba', '25': 'RN - Rio Grande do Norte', '26': 'AL - Alagoas', '27': 'CE - Ceará',
  '28': 'PI - Piauí', '29': 'MA - Maranhão', '30': 'PA - Pará', '31': 'AM - Amazonas', '32': 'AP - Amapá',
  '33': 'RO - Rondônia', '34': 'RR - Roraima', '35': 'AC - Acre', '36': 'MT - Mato Grosso',
  '37': 'MS - Mato Grosso do Sul', '38': 'DF - Brasília', '39': 'GO - Goiás', '40': 'TO - Tocantins',
  '41': 'GO - Sudeste de Goiás',
}

// Cesta EV (paginas /seguro/carro-eletrico) - termo de busca na fipe-api
// Cesta eletricos/hibridos com presenca real na base SUSEP 2021
// (BYD so chegou ao Brasil depois - fica pra proxima atualizacao da base)
const EVS = [
  { slug: 'nissan-leaf', busca: 'leaf', nome: 'Nissan Leaf (elétrico)' },
  { slug: 'chevrolet-bolt', busca: 'bolt ev', nome: 'Chevrolet Bolt (elétrico)' },
  { slug: 'renault-zoe', busca: 'zoe', nome: 'Renault Zoe (elétrico)' },
  { slug: 'toyota-prius', busca: 'prius 1.8', nome: 'Toyota Prius (híbrido)' },
  { slug: 'toyota-corolla-hybrid', busca: 'corolla altis hybrid', nome: 'Toyota Corolla Hybrid' },
  { slug: 'audi-e-tron', busca: 'e-tron', nome: 'Audi e-tron (elétrico)' },
]

// Cesta populares (comparativo + ranking das 41 regioes)
const POPULARES = [
  { slug: 'chevrolet-onix', busca: 'onix hatch 1.0 12v flex 5p mec', nome: 'Chevrolet Onix' },
  { slug: 'hyundai-hb20', busca: 'hb20 sense 1.0 flex', nome: 'Hyundai HB20' },
  { slug: 'volkswagen-gol', busca: 'gol 1.0 flex 12v 5p', nome: 'VW Gol' },
  { slug: 'fiat-strada', busca: 'strada working 1.4', nome: 'Fiat Strada' },
  { slug: 'toyota-corolla', busca: 'corolla xei 2.0 flex', nome: 'Toyota Corolla' },
]

// Regioes das tabelas por modelo (paginas /tabela-fipe)
const REGIOES_MODELO = ['11', '18', '16', '07']

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function api(path: string): Promise<any | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers: HEADERS })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      return d?.success ? d.data : null
    } catch (e) {
      if (attempt === 3) return null
      await sleep(400 * attempt)
    }
  }
  return null
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

async function resolveModelId(busca: string, brandName?: string): Promise<{ id: number; nome: string } | null> {
  const results = await api(`/search?q=${encodeURIComponent(busca)}&vehicle_type=1`)
  if (!results?.length) return null
  if (brandName) {
    // o /search casa o q num campo so; buscamos pelo modelo e validamos a
    // marca aqui ("Chevrolet" precisa aparecer em "GM - Chevrolet")
    const alvo = norm(brandName)
    const hit = results.find((r: any) => norm(r.brand_name).includes(alvo) || alvo.includes(norm(r.brand_name)))
    if (!hit) return null
    return { id: hit.model_id, nome: hit.model_name }
  }
  return { id: results[0].model_id, nome: results[0].model_name }
}

/** Valor FIPE do modelo pro ano dado (preco mais recente daquele ano-modelo). */
async function valorFipe(modelId: number, ano: number): Promise<number | null> {
  const d = await api(`/models/${modelId}/price-history`)
  const grupos = d?.price_history || []
  for (const g of grupos) {
    if (g.year === ano && g.prices?.length) return g.prices[0].price
  }
  return null
}

function pctFipe(premio: number, fipe: number | null): number | null {
  if (!fipe || fipe <= 0) return null
  return Math.round((premio / fipe) * 1000) / 10  // 1 casa decimal
}

/** Estimativa tentando anos do mais recente pro mais antigo (max 5). */
async function estimativa(modelId: number, regiao: string, anos: number[]): Promise<{ ano: number; premio: number; franquia: number } | null> {
  for (const ano of anos) {
    const d = await api(`/models/${modelId}/insurance-estimate?ano=${ano}&regiao=${regiao}`)
    if (d?.seguro?.premioMedioEstimado) {
      return {
        ano,
        premio: Math.round(d.seguro.premioMedioEstimado),
        franquia: Math.round(d.seguro.franquiaMediaEstimada || 0),
      }
    }
  }
  return null
}

// Base R_AUTO = apolices jan-jun/2021: o grosso dos dados esta em
// anos-modelo 2021 e ANTERIORES. Tentar anos novos primeiro era inutil.
const ANOS_TENTATIVA = [2021, 2020, 2019, 2018, 2017]

async function main() {
  // ============ 1. EVs x 27 UFs ============
  console.log('== EVs ==')
  const evResolved: { slug: string; nome: string; id: number }[] = []
  for (const ev of EVS) {
    const r = await resolveModelId(ev.busca)
    if (r) { evResolved.push({ slug: ev.slug, nome: ev.nome, id: r.id }); console.log(`  ${ev.nome} -> ${r.id} (${r.nome})`) }
    else console.log(`  ${ev.nome} -> NAO RESOLVIDO`)
  }

  const eletricos: Record<string, any> = {}
  for (const [uf, regiao] of Object.entries(UF_REGIAO)) {
    const modelos: any[] = []
    for (const ev of evResolved) {
      const est = await estimativa(ev.id, regiao.codigo, ANOS_TENTATIVA)
      if (est) {
        const fipe = await valorFipe(ev.id, est.ano)
        modelos.push({ slug: ev.slug, nome: ev.nome, ...est, fipeValor: fipe, pctFipe: pctFipe(est.premio, fipe) })
      }
    }
    const media = modelos.length ? Math.round(modelos.reduce((s, m) => s + m.premio, 0) / modelos.length) : null
    eletricos[uf] = { regiao, modelos, mediaPremio: media }
    console.log(`  ${uf}: ${modelos.length} modelos, media R$${media}`)
  }
  writeFileSync('data/seguro-eletricos.json', JSON.stringify(eletricos, null, 1))

  // ============ 2. Todos os modelos x 4 regioes ============
  console.log('== Modelos (tabela-fipe) ==')
  const modelosOut: Record<string, any> = {}
  for (const brand of Object.values(fipeBrands)) {
    if (brand.type !== 'carros') continue  // base SUSEP de moto e rala; so carros
    for (const model of brand.models) {
      const slug = `${brand.slug}-${model.slug}`
      // O primeiro resultado da busca pode ser uma versao sem dado na base
      // 2021 (trim novo demais ou antigo demais). Itera pelos candidatos da
      // marca ate achar um com estimativa na regiao 11.
      const results = await api(`/search?q=${encodeURIComponent(model.name)}&vehicle_type=1`)
      if (!results?.length) continue
      const alvo = norm(brand.name)
      const candidatos = results
        .filter((x: any) => norm(x.brand_name).includes(alvo) || alvo.includes(norm(x.brand_name)))
        .slice(0, 8)
      let escolhido: { id: number } | null = null
      let est11: { ano: number; premio: number; franquia: number } | null = null
      for (const cand of candidatos) {
        est11 = await estimativa(cand.model_id, '11', ANOS_TENTATIVA)
        if (est11) { escolhido = { id: cand.model_id }; break }
      }
      if (!escolhido || !est11) continue
      const regioes: Record<string, { premio: number; franquia: number }> = {
        '11': { premio: est11.premio, franquia: est11.franquia },
      }
      const ano: number = est11.ano
      for (const reg of REGIOES_MODELO.filter(x => x !== '11')) {
        const est = await estimativa(escolhido.id, reg, [ano])
        if (est) regioes[reg] = { premio: est.premio, franquia: est.franquia }
      }
      const premios = Object.values(regioes).map(x => x.premio)
      const fipe = await valorFipe(escolhido.id, ano)
      const mediaPremio = Math.round(premios.reduce((s, v) => s + v, 0) / premios.length)
      modelosOut[slug] = {
        nome: `${brand.name} ${model.name}`, ano,
        regioes, faixa: { min: Math.min(...premios), max: Math.max(...premios) },
        fipeValor: fipe, pctFipe: pctFipe(mediaPremio, fipe),
      }
      console.log(`  ${slug}: ano ${ano}, ${premios.length} regioes, R$${Math.min(...premios)}-${Math.max(...premios)}`)
    }
  }
  writeFileSync('data/seguro-modelos.json', JSON.stringify(modelosOut, null, 1))

  // ============ 3. Cesta populares: 27 UFs + ranking 41 regioes ============
  console.log('== Populares / ranking ==')
  const popResolved: { nome: string; id: number }[] = []
  for (const p of POPULARES) {
    const r = await resolveModelId(p.busca)
    if (r) { popResolved.push({ nome: p.nome, id: r.id }); console.log(`  ${p.nome} -> ${r.id}`) }
  }

  const estados: Record<string, any> = {}
  for (const [uf, regiao] of Object.entries(UF_REGIAO)) {
    const premios: number[] = []
    for (const p of popResolved) {
      const est = await estimativa(p.id, regiao.codigo, ANOS_TENTATIVA)
      if (est) premios.push(est.premio)
    }
    estados[uf] = {
      regiao,
      mediaPopulares: premios.length ? Math.round(premios.reduce((s, v) => s + v, 0) / premios.length) : null,
      amostraModelos: premios.length,
    }
    console.log(`  ${uf}: media populares R$${estados[uf].mediaPopulares} (${premios.length} modelos)`)
  }

  const ranking: { codigo: string; nome: string; media: number; amostra: number }[] = []
  for (const [codigo, nome] of Object.entries(REGIOES_41)) {
    const premios: number[] = []
    for (const p of popResolved) {
      const est = await estimativa(p.id, codigo, ANOS_TENTATIVA)
      if (est) premios.push(est.premio)
    }
    if (premios.length >= 3) {
      ranking.push({ codigo, nome, media: Math.round(premios.reduce((s, v) => s + v, 0) / premios.length), amostra: premios.length })
    }
    console.log(`  regiao ${codigo}: ${premios.length} modelos`)
  }
  ranking.sort((a, b) => b.media - a.media)
  writeFileSync('data/seguro-estados.json', JSON.stringify({ compiladoEm: '2026-07-24', estados, ranking }, null, 1))
  console.log('== FIM ==')
}

main()
