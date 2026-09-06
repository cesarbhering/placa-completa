// Segmento do veiculo, decidido num lugar so.
//
// Existe porque o relatorio tratava tudo como carro: o funil da FIPE usava
// carroceria e litragem numa scooter, o custo de cinco anos saia com IPVA e
// manutencao de automovel, e a copy falava "carro" pra quem consultou uma moto.
// Com muitos clientes de moto, isso deixou de ser detalhe.
//
// A ordem das checagens vai do sinal mais explicito pro mais inferido, e a
// cilindrada e o ULTIMO criterio de proposito: 150cc e moto, mas 1000cc pode
// ser moto grande ou carro popular antigo.

export type Segmento = 'carro' | 'moto' | 'caminhao' | 'outro'

export interface FatosSegmento {
  /** Payload cru da fonte livre (segmento, sub_segmento, extra.tipo_veiculo). */
  wdapi?: any
  /** Registro do veiculo (descricaoTipoVeiculo, descricaoEspecie, cilindrada). */
  senatran?: any
  /** Chassi: o WMI (3 primeiros) identifica fabricante de moto. */
  chassi?: string | null
}

const RE_MOTO = /MOTO|MOTONETA|MOTOCICLETA|CICLOMOTOR|TRICICLO|QUADRICICLO|SCOOTER/i
const RE_CAMINHAO = /CAMINHAO|CAMINHÃO|ONIBUS|ÔNIBUS|MICROONIBUS|REBOQUE|SEMIRREBOQUE|TRATOR/i

// WMIs de fabricantes que so produzem duas rodas no Brasil. Vem da mesma
// curadoria do vin-decoder (services/vin-decoder/scripts/overrides-br.mjs),
// onde cada entrada tem fonte conferida.
const WMI_MOTO = new Set(['9C2', '9C6', '9CD', '9C1', '94J'])

function texto(...vs: unknown[]): string {
  return vs.map((v) => String(v ?? '')).join(' ')
}

export function detectarSegmento(fatos: FatosSegmento): Segmento {
  const w = fatos.wdapi || {}
  const s = fatos.senatran || {}

  const explicito = texto(
    w.segmento, w.sub_segmento, w.extra?.tipo_veiculo, w.extra?.especie,
    s.descricaoTipoVeiculo, s.descricaoEspecie,
  )
  if (RE_MOTO.test(explicito)) return 'moto'
  if (RE_CAMINHAO.test(explicito)) return 'caminhao'

  const wmi = String(fatos.chassi || '').toUpperCase().slice(0, 3)
  if (wmi && WMI_MOTO.has(wmi)) return 'moto'

  // Cilindrada pequena SEM litragem no nome do modelo. O "1." e o que separa
  // um carro 1.0 de uma moto 400: carro traz a litragem no nome, moto nao.
  const cilindrada = Number(s.cilindrada ?? w.extra?.cilindradas ?? 0)
  const modelo = texto(s.descricaoMarcaModelo, w.MODELO, w.modelo)
  if (cilindrada > 0 && cilindrada <= 400 && !/\b\d\.\d\b/.test(modelo)) return 'moto'

  if (explicito.trim() || modelo.trim()) return 'carro'
  return 'outro'
}

/** Como o relatorio chama o veiculo na copy: "esta moto", "este carro". */
export function nomeDoVeiculo(segmento: Segmento): string {
  if (segmento === 'moto') return 'moto'
  if (segmento === 'caminhao') return 'caminhão'
  if (segmento === 'carro') return 'carro'
  return 'veículo'
}

/** Artigo definido pra montar frase: "esta moto" x "este carro". */
export function artigoDoVeiculo(segmento: Segmento): 'esta' | 'este' {
  return segmento === 'moto' ? 'esta' : 'este'
}

/**
 * Custo de cinco anos e seguro sao modelados pra AUTOMOVEL: aliquota de IPVA de
 * passeio, piso de manutencao de carro, fatores por carroceria. Aplicar isso a
 * uma moto infla o numero de forma grosseira, entao o relatorio prefere nao
 * mostrar a estimar errado.
 */
export function aceitaCustoDeCarro(segmento: Segmento): boolean {
  return segmento === 'carro'
}
