export interface FipeModel {
  slug: string
  name: string
  /** Versao principal na fipe-api (codigo_modelo): tabela da versao e grafico. */
  fipeCode?: string
  /**
   * Outras versoes do mesmo modelo, para o valor por ano (shared/fipe-por-ano.ts).
   * Sem isto, o "por ano" sai so da versao principal.
   */
  fipeCodes?: string[]
  /** Genero do nome ("a Doblò", "a XT 660"); padrao: masculino em carro, feminino em moto. */
  genero?: 'm' | 'f'
  years?: string
  /** Texto único de 2-3 parágrafos para evitar páginas templated-demais (SEO). */
  seoIntro?: string
  /** Lista de modelos relacionados pra interlinking. */
  related?: string[]
}

export interface FipeBrand {
  slug: string
  name: string
  fipeCode: string
  type: 'carros' | 'motos'
  description: string
  models: FipeModel[]
}

export const fipeBrands: Record<string, FipeBrand> = {
  // === CARROS ===
  volkswagen: {
    slug: 'volkswagen', name: 'Volkswagen', fipeCode: '59', type: 'carros',
    description: 'A Volkswagen é a montadora mais vendida do Brasil há décadas. Modelos como Gol, Polo, T-Cross e Saveiro são presença constante nas ruas e nas lojas de veículos usados.',
    models: [
      { slug: 'gol', name: 'Gol', fipeCode: '8323' },
      { slug: 'polo', name: 'Polo' },
      { slug: 'saveiro', name: 'Saveiro' },
      { slug: 't-cross', name: 'T-Cross' },
      { slug: 'virtus', name: 'Virtus' },
      { slug: 'nivus', name: 'Nivus', fipeCode: '9150' },
      { slug: 'amarok', name: 'Amarok' },
      { slug: 'taos', name: 'Taos' },
      { slug: 'tiguan', name: 'Tiguan' },
      { slug: 'voyage', name: 'Voyage' },
      { slug: 'fox', name: 'Fox' },
      { slug: 'up', name: 'Up!', fipeCode: '8702' },
      { slug: 'jetta', name: 'Jetta', fipeCode: '5514', fipeCodes: ['4147', '5512', '5513', '7216', '7493', '7494', '8487', '8488', '8717'] },
      { slug: 'golf', name: 'Golf', fipeCode: '4006', fipeCodes: ['2438', '2440', '2441', '2446', '4312', '4703', '6797', '6601', '6600', '7462', '8371', '8370'] },
      { slug: 'fusca', name: 'Fusca' },
    ],
  },
  fiat: {
    slug: 'fiat', name: 'Fiat', fipeCode: '21', type: 'carros',
    description: 'A Fiat é uma das marcas mais populares do Brasil, com modelos como Argo, Mobi, Strada e Toro dominando os rankings de vendas de novos e usados.',
    models: [
      { slug: 'argo', name: 'Argo' },
      { slug: 'mobi', name: 'Mobi' },
      { slug: 'strada', name: 'Strada', fipeCode: '603' },
      { slug: 'toro', name: 'Toro' },
      { slug: 'pulse', name: 'Pulse' },
      { slug: 'fastback', name: 'Fastback' },
      { slug: 'cronos', name: 'Cronos' },
      { slug: 'uno', name: 'Uno' },
      { slug: 'palio', name: 'Palio', fipeCode: '506' },
      { slug: 'siena', name: 'Siena' },
      { slug: 'fiorino', name: 'Fiorino' },
      { slug: 'ducato', name: 'Ducato' },
      { slug: 'doblo', name: 'Doblò', genero: 'f', fipeCode: '5536', fipeCodes: ['452', '451', '446', '3933', '3935', '4097', '5535'] },
      { slug: '500', name: '500' },
    ],
  },
  chevrolet: {
    slug: 'chevrolet', name: 'Chevrolet', fipeCode: '23', type: 'carros',
    description: 'A Chevrolet é uma das maiores montadoras do Brasil, com o Onix liderando as vendas por anos. Modelos como Tracker, S10 e Spin são muito procurados no mercado de usados.',
    models: [
      { slug: 'onix', name: 'Onix' },
      { slug: 'onix-plus', name: 'Onix Plus' },
      { slug: 'tracker', name: 'Tracker' },
      { slug: 's10', name: 'S10' },
      { slug: 'spin', name: 'Spin' },
      { slug: 'montana', name: 'Montana', fipeCode: '10401' },
      { slug: 'equinox', name: 'Equinox' },
      { slug: 'cruze', name: 'Cruze' },
      { slug: 'prisma', name: 'Prisma' },
      { slug: 'cobalt', name: 'Cobalt', fipeCode: '5724' },
      { slug: 'celta', name: 'Celta', fipeCode: '991' },
      { slug: 'corsa', name: 'Corsa' },
      { slug: 'trailblazer', name: 'TrailBlazer' },
    ],
  },
  hyundai: {
    slug: 'hyundai', name: 'Hyundai', fipeCode: '26', type: 'carros',
    description: 'A Hyundai se consolidou no mercado brasileiro com o HB20, um dos carros mais vendidos do país. A marca também se destaca com Creta, Tucson e a linha de SUVs.',
    models: [
      { slug: 'hb20', name: 'HB20' },
      { slug: 'hb20s', name: 'HB20S' },
      { slug: 'creta', name: 'Creta' },
      { slug: 'tucson', name: 'Tucson' },
      { slug: 'ix35', name: 'ix35', fipeCode: '5931', fipeCodes: ['5280', '5279', '5932', '7858', '7859'] },
      { slug: 'santa-fe', name: 'Santa Fe' },
      { slug: 'hb20x', name: 'HB20X' },
      { slug: 'azera', name: 'Azera', fipeCode: '5726', fipeCodes: ['4403'] },
      { slug: 'i30', name: 'i30' },
      { slug: 'veloster', name: 'Veloster' },
    ],
  },
  toyota: {
    slug: 'toyota', name: 'Toyota', fipeCode: '56', type: 'carros',
    description: 'A Toyota é sinônimo de durabilidade e valor de revenda no Brasil. O Corolla é o sedã mais vendido do país, e a Hilux domina o segmento de picapes.',
    models: [
      { slug: 'corolla', name: 'Corolla', fipeCode: '5194', fipeCodes: ['2229', '2230', '2231', '2233', '2234', '2225', '5041', '9300', '8839', '9301', '9985'] },
      { slug: 'corolla-cross', name: 'Corolla Cross' },
      { slug: 'hilux', name: 'Hilux' },
      { slug: 'hilux-sw4', name: 'Hilux SW4', genero: 'f', fipeCode: '4906', fipeCodes: ['2276', '2277', '3830', '6077', '4907', '7491', '8111', '9662', '10927'] },
      { slug: 'yaris', name: 'Yaris' },
      { slug: 'rav4', name: 'RAV4' },
      { slug: 'etios', name: 'Etios' },
      { slug: 'camry', name: 'Camry' },
      { slug: 'prius', name: 'Prius' },
      { slug: 'bandeirante', name: 'Bandeirante' },
    ],
  },
  honda: {
    slug: 'honda', name: 'Honda', fipeCode: '25', type: 'carros',
    description: 'A Honda é reconhecida pela confiabilidade dos seus motores e alto valor de revenda. O Civic e o HR-V estão entre os veículos mais desejados do mercado brasileiro.',
    models: [
      { slug: 'civic', name: 'Civic', fipeCode: '4010', fipeCodes: ['1258', '1262', '1263', '1260', '1264', '1265', '4009', '4011', '4292', '5149', '6325', '6326', '7692', '7693', '7694', '7696', '8779', '10366'] },
      { slug: 'hr-v', name: 'HR-V', fipeCode: '7150' },
      { slug: 'city', name: 'City', fipeCode: '4975' },
      { slug: 'fit', name: 'Fit', fipeCode: '10815', fipeCodes: ['1275', '1276', '1277', '1274', '4799', '5469', '6780', '6781', '8050'] },
      { slug: 'wr-v', name: 'WR-V' },
      { slug: 'cr-v', name: 'CR-V' },
      { slug: 'accord', name: 'Accord' },
      { slug: 'zr-v', name: 'ZR-V' },
    ],
  },
  renault: {
    slug: 'renault', name: 'Renault', fipeCode: '48', type: 'carros',
    description: 'A Renault conquistou o mercado brasileiro com veículos acessíveis e econômicos. O Kwid é um dos carros mais baratos do Brasil, e o Duster lidera entre os SUVs de entrada.',
    models: [
      { slug: 'kwid', name: 'Kwid' },
      { slug: 'duster', name: 'Duster' },
      { slug: 'sandero', name: 'Sandero' },
      { slug: 'logan', name: 'Logan' },
      { slug: 'captur', name: 'Captur' },
      { slug: 'oroch', name: 'Oroch' },
      { slug: 'master', name: 'Master' },
      { slug: 'clio', name: 'Clio' },
    ],
  },
  jeep: {
    slug: 'jeep', name: 'Jeep', fipeCode: '29', type: 'carros',
    description: 'A Jeep é líder no segmento de SUVs no Brasil. O Renegade e o Compass são os modelos mais populares, fabricados em Pernambuco.',
    models: [
      { slug: 'renegade', name: 'Renegade' },
      { slug: 'compass', name: 'Compass' },
      { slug: 'commander', name: 'Commander' },
      { slug: 'wrangler', name: 'Wrangler' },
      { slug: 'grand-cherokee', name: 'Grand Cherokee' },
      { slug: 'cherokee', name: 'Cherokee' },
    ],
  },
  ford: {
    slug: 'ford', name: 'Ford', fipeCode: '22', type: 'carros',
    description: 'A Ford tem presença histórica no Brasil. Apesar de ter encerrado a produção nacional, modelos como Ka, EcoSport, Ranger e Territory continuam muito procurados no mercado de usados.',
    models: [
      { slug: 'ka', name: 'Ka', fipeCode: '6915', fipeCodes: ['813', '818', '814', '823', '4514', '4515', '4789', '6914', '6916', '6917', '8149', '8401', '8441', '8442'] },
      { slug: 'ecosport', name: 'EcoSport' },
      { slug: 'ranger', name: 'Ranger' },
      { slug: 'territory', name: 'Territory' },
      { slug: 'bronco-sport', name: 'Bronco Sport' },
      { slug: 'fiesta', name: 'Fiesta' },
      { slug: 'focus', name: 'Focus' },
      { slug: 'fusion', name: 'Fusion' },
      { slug: 'maverick', name: 'Maverick' },
      { slug: 'f-250', name: 'F-250' },
    ],
  },
  nissan: {
    slug: 'nissan', name: 'Nissan', fipeCode: '43', type: 'carros',
    description: 'A Nissan se destaca no Brasil com o Kicks, um dos SUVs compactos mais vendidos, e a Frontier, referência em picapes médias.',
    models: [
      { slug: 'kicks', name: 'Kicks' },
      { slug: 'frontier', name: 'Frontier' },
      { slug: 'versa', name: 'Versa' },
      { slug: 'sentra', name: 'Sentra' },
      { slug: 'march', name: 'March' },
      { slug: 'livina', name: 'Livina' },
    ],
  },
  peugeot: {
    slug: 'peugeot', name: 'Peugeot', fipeCode: '44', type: 'carros',
    description: 'A Peugeot oferece modelos com design diferenciado no mercado brasileiro. O 208 e o 2008 são os carros-chave da marca no Brasil.',
    models: [
      { slug: '208', name: '208' },
      { slug: '2008', name: '2008' },
      { slug: '3008', name: '3008' },
      { slug: '308', name: '308' },
      { slug: '207', name: '207' },
      { slug: '206', name: '206' },
    ],
  },
  citroen: {
    slug: 'citroen', name: 'Citroën', fipeCode: '13', type: 'carros',
    description: 'A Citroën se diferencia pelo conforto e suspensão. O C3 e o C4 Cactus são modelos populares no mercado brasileiro.',
    models: [
      { slug: 'c3', name: 'C3' },
      { slug: 'c4-cactus', name: 'C4 Cactus' },
      { slug: 'aircross', name: 'Aircross' },
      { slug: 'c3-aircross', name: 'C3 Aircross' },
      { slug: 'c4-lounge', name: 'C4 Lounge' },
    ],
  },
  mitsubishi: {
    slug: 'mitsubishi', name: 'Mitsubishi', fipeCode: '41', type: 'carros',
    description: 'A Mitsubishi é referência em veículos 4x4 no Brasil. O Outlander, Eclipse Cross e L200 Triton são os modelos mais procurados.',
    models: [
      { slug: 'outlander', name: 'Outlander' },
      { slug: 'eclipse-cross', name: 'Eclipse Cross' },
      { slug: 'l200-triton', name: 'L200 Triton' },
      { slug: 'asx', name: 'ASX' },
      { slug: 'pajero', name: 'Pajero' },
      { slug: 'pajero-sport', name: 'Pajero Sport' },
      { slug: 'lancer', name: 'Lancer', fipeCode: '5733' },
    ],
  },
  bmw: {
    slug: 'bmw', name: 'BMW', fipeCode: '7', type: 'carros',
    description: 'A BMW é sinônimo de esportividade e luxo no Brasil. A Série 3, o X1 e o X3 são os modelos mais vendidos da marca no país.',
    models: [
      { slug: 'serie-3', name: 'Série 3' },
      { slug: 'x1', name: 'X1' },
      { slug: 'x3', name: 'X3' },
      { slug: 'x5', name: 'X5' },
      { slug: 'serie-1', name: 'Série 1' },
      { slug: '320i', name: '320i', fipeCode: '6090' },
    ],
  },
  audi: {
    slug: 'audi', name: 'Audi', fipeCode: '6', type: 'carros',
    description: 'A Audi oferece veículos premium com tecnologia de ponta. O A3, Q3 e Q5 são os modelos mais populares da marca no Brasil.',
    models: [
      { slug: 'a3', name: 'A3' },
      { slug: 'q3', name: 'Q3' },
      { slug: 'q5', name: 'Q5' },
      { slug: 'a4', name: 'A4' },
      { slug: 'a5', name: 'A5' },
      { slug: 'q7', name: 'Q7' },
    ],
  },
  byd: {
    slug: 'byd', name: 'BYD', fipeCode: '238', type: 'carros',
    description: 'A BYD é a marca de carros elétricos e híbridos que mais cresce no Brasil. O Dolphin, Song Plus e Seal estão revolucionando o mercado nacional.',
    models: [
      { slug: 'dolphin', name: 'Dolphin' },
      { slug: 'dolphin-mini', name: 'Dolphin Mini' },
      { slug: 'song-plus', name: 'Song Plus' },
      { slug: 'song-pro', name: 'Song Pro' },
      { slug: 'seal', name: 'Seal' },
      { slug: 'tan', name: 'Tan' },
      { slug: 'han', name: 'Han' },
      { slug: 'shark', name: 'Shark' },
      { slug: 'king', name: 'King' },
    ],
  },
  // === MOTOS ===
  'honda-motos': {
    slug: 'honda-motos', name: 'Honda Motos', fipeCode: '80', type: 'motos',
    description: 'A Honda é a líder absoluta do mercado de motos no Brasil. A CG 160, Biz e CB 300 estão entre as motos mais vendidas e procuradas do país.',
    models: [
      { slug: 'cg-160', name: 'CG 160', fipeCode: '7330' },
      { slug: 'biz', name: 'Biz', fipeCode: '7467' },
      { slug: 'cb-300', name: 'CB 300' },
      { slug: 'xre-300', name: 'XRE 300' },
      { slug: 'pcx', name: 'PCX' },
      { slug: 'cb-500', name: 'CB 500' },
      { slug: 'cbr-650', name: 'CBR 650' },
      { slug: 'pop-110', name: 'Pop 110' },
      { slug: 'nxr-160-bros', name: 'NXR 160 Bros' },
      { slug: 'elite-125', name: 'Elite 125' },
      { slug: 'cb-650r', name: 'CB 650R', fipeCode: '9030' },
      { slug: 'africa-twin', name: 'Africa Twin' },
    ],
  },
  'yamaha': {
    slug: 'yamaha', name: 'Yamaha', fipeCode: '101', type: 'motos',
    description: 'A Yamaha é a segunda maior fabricante de motos do Brasil. A Fazer 250, MT-03, Crosser e NMAX são modelos de grande sucesso no mercado.',
    models: [
      { slug: 'fazer-250', name: 'Fazer 250' },
      { slug: 'mt-03', name: 'MT-03', fipeCode: '7527' },
      { slug: 'crosser', name: 'Crosser' },
      { slug: 'nmax', name: 'NMAX' },
      { slug: 'factor', name: 'Factor' },
      { slug: 'lander', name: 'Lander', fipeCode: '4195' },
      { slug: 'mt-07', name: 'MT-07' },
      { slug: 'mt-09', name: 'MT-09' },
      { slug: 'tenere', name: 'Ténéré 250', fipeCode: '5442' },
      { slug: 'xtz-150', name: 'XTZ 150' },
      { slug: 'r3', name: 'R3' },
    ],
  },
}

export const brandSlugs = Object.keys(fipeBrands)

// Generate all model page slugs
export function getAllModelSlugs(): string[] {
  const slugs: string[] = []
  for (const brand of Object.values(fipeBrands)) {
    for (const model of brand.models) {
      slugs.push(`${brand.slug}-${model.slug}`)
    }
  }
  return slugs
}

// Find brand+model by combined slug
export function findBrandModel(combinedSlug: string): { brand: FipeBrand; model: FipeModel } | null {
  for (const brand of Object.values(fipeBrands)) {
    const prefix = `${brand.slug}-`
    if (combinedSlug.startsWith(prefix)) {
      const modelSlug = combinedSlug.slice(prefix.length)
      const model = brand.models.find(m => m.slug === modelSlug)
      if (model) return { brand, model }
    }
  }
  return null
}
