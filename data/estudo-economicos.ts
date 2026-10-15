// Estudo "Consumo (Inmetro) x preco FIPE" do post carros-usados-mais-economicos.
// Metodologia (tambem explicada no post):
//  - consumo: tabelas PBEV do Inmetro (km/l, cidade e estrada, etanol e gasolina). Cada modelo usa a
//    tabela do seu ano-modelo (2022, 2023 ou 2024); o campo pbev diz qual.
//  - combinado: media harmonica ponderada 55% cidade e 45% estrada (a mesma formula do Inmetro; confere
//    com a coluna "combinado" em 261 de 261 linhas flex da tabela 2026).
//  - preco: Tabela FIPE, referencia outubro/2026, do mesmo ano-modelo e versao.
//  - combustivel: sintese semanal ANP edicao 41/2026 (04 a 10/10): gasolina R$ 6,54 e etanol R$ 4,14 por litro.
// Nao publicar nenhum numero que nao saia deste arquivo.

export type Cat = 'Hatch' | 'Sedã' | 'SUV'
export interface ModeloEstudo {
  cat: Cat
  modelo: string
  anoModelo: number
  fipe: number // R$, FIPE out/2026
  etanol: [number, number] // km/l cidade, estrada
  gasolina: [number, number]
  pbev: number // ano da tabela PBEV usada
}

export const PRECO_GASOLINA = 6.54
export const PRECO_ETANOL = 4.14

export const estudoModelos: ModeloEstudo[] = [
  { cat: 'Hatch', modelo: 'Fiat Mobi Like 1.0', anoModelo: 2024, fipe: 55696, etanol: [9.6, 10.4], gasolina: [13.5, 15.0], pbev: 2024 },
  { cat: 'Hatch', modelo: 'Fiat Argo Drive 1.0', anoModelo: 2024, fipe: 67386, etanol: [9.4, 10.6], gasolina: [13.6, 15.1], pbev: 2024 },
  { cat: 'Hatch', modelo: 'Hyundai HB20 Sense 1.0', anoModelo: 2022, fipe: 58717, etanol: [9.8, 10.7], gasolina: [13.1, 15.0], pbev: 2022 },
  { cat: 'Hatch', modelo: 'Chevrolet Onix LT 1.0 manual', anoModelo: 2022, fipe: 61528, etanol: [9.5, 12.0], gasolina: [13.8, 16.6], pbev: 2022 },
  { cat: 'Hatch', modelo: 'VW Polo MPI 1.0', anoModelo: 2023, fipe: 68260, etanol: [9.6, 10.9], gasolina: [14.0, 15.4], pbev: 2023 },
  { cat: 'Hatch', modelo: 'Renault Kwid Zen 1.0', anoModelo: 2024, fipe: 50739, etanol: [10.8, 11.0], gasolina: [15.3, 15.7], pbev: 2024 },
  { cat: 'Hatch', modelo: 'Citroën C3 Feel 1.0', anoModelo: 2024, fipe: 66884, etanol: [9.3, 10.5], gasolina: [13.0, 14.6], pbev: 2024 },
  { cat: 'Hatch', modelo: 'VW Gol 1.0', anoModelo: 2023, fipe: 54401, etanol: [9.4, 10.7], gasolina: [13.7, 15.2], pbev: 2023 },
  { cat: 'Sedã', modelo: 'Chevrolet Onix Plus LT 1.0 manual', anoModelo: 2022, fipe: 62384, etanol: [9.6, 12.5], gasolina: [13.8, 17.6], pbev: 2022 },
  { cat: 'Sedã', modelo: 'Hyundai HB20S Comfort 1.0', anoModelo: 2024, fipe: 75358, etanol: [9.4, 10.4], gasolina: [13.2, 15.0], pbev: 2024 },
  { cat: 'Sedã', modelo: 'Fiat Cronos Drive 1.3', anoModelo: 2022, fipe: 65657, etanol: [9.1, 11.2], gasolina: [13.0, 15.9], pbev: 2022 },
  { cat: 'Sedã', modelo: 'VW Virtus TSI 1.0 manual', anoModelo: 2023, fipe: 78530, etanol: [9.2, 11.3], gasolina: [13.5, 15.9], pbev: 2023 },
  { cat: 'Sedã', modelo: 'Renault Logan Life 1.0', anoModelo: 2024, fipe: 60516, etanol: [9.6, 9.8], gasolina: [13.6, 14.4], pbev: 2024 },
  { cat: 'Sedã', modelo: 'Honda City EX 1.5 CVT', anoModelo: 2022, fipe: 92073, etanol: [9.2, 10.5], gasolina: [13.1, 15.2], pbev: 2022 },
  { cat: 'Sedã', modelo: 'Nissan Versa Sense 1.6 CVT', anoModelo: 2024, fipe: 91295, etanol: [8.1, 10.5], gasolina: [11.8, 15.0], pbev: 2024 },
  { cat: 'Sedã', modelo: 'Toyota Corolla XEi 2.0', anoModelo: 2024, fipe: 137005, etanol: [8.6, 10.7], gasolina: [12.3, 14.9], pbev: 2024 },
  { cat: 'SUV', modelo: 'Hyundai Creta Action 1.6', anoModelo: 2024, fipe: 99039, etanol: [7.1, 8.1], gasolina: [9.7, 12.1], pbev: 2024 },
  { cat: 'SUV', modelo: 'Hyundai Creta Comfort 1.0 turbo', anoModelo: 2022, fipe: 100041, etanol: [8.2, 8.9], gasolina: [12.0, 12.2], pbev: 2022 },
  { cat: 'SUV', modelo: 'VW T-Cross 200 TSI', anoModelo: 2024, fipe: 103689, etanol: [8.2, 10.1], gasolina: [11.9, 14.3], pbev: 2024 },
  { cat: 'SUV', modelo: 'Nissan Kicks Sense 1.6 CVT', anoModelo: 2024, fipe: 101726, etanol: [7.8, 9.5], gasolina: [11.4, 13.8], pbev: 2024 },
  { cat: 'SUV', modelo: 'Renault Duster Zen 1.6 manual', anoModelo: 2024, fipe: 78919, etanol: [8.1, 8.5], gasolina: [11.6, 12.3], pbev: 2024 },
  { cat: 'SUV', modelo: 'Honda HR-V EX 1.5', anoModelo: 2023, fipe: 129330, etanol: [8.8, 9.8], gasolina: [12.7, 13.9], pbev: 2023 },
  { cat: 'SUV', modelo: 'Chevrolet Tracker 1.0 turbo', anoModelo: 2024, fipe: 99501, etanol: [7.8, 9.6], gasolina: [11.2, 13.6], pbev: 2024 },
  { cat: 'SUV', modelo: 'Fiat Pulse Drive 1.3 manual', anoModelo: 2024, fipe: 86356, etanol: [9.0, 10.4], gasolina: [12.5, 14.7], pbev: 2024 },
  { cat: 'SUV', modelo: 'VW Nivus Comfortline 200 TSI', anoModelo: 2024, fipe: 102797, etanol: [8.3, 9.9], gasolina: [11.9, 14.1], pbev: 2024 },
  { cat: 'SUV', modelo: 'Jeep Compass Limited 1.3 turbo', anoModelo: 2023, fipe: 131646, etanol: [7.2, 8.7], gasolina: [10.1, 12.0], pbev: 2023 },
  { cat: 'SUV', modelo: 'Renault Captur Zen 1.3 turbo', anoModelo: 2024, fipe: 102084, etanol: [7.7, 8.2], gasolina: [10.9, 11.6], pbev: 2024 },
]

export function combinado([cidade, estrada]: [number, number]): number {
  return 1 / (0.55 / cidade + 0.45 / estrada)
}
export function custoKm(m: ModeloEstudo, combustivel: 'gasolina' | 'etanol'): number {
  return combustivel === 'gasolina' ? PRECO_GASOLINA / combinado(m.gasolina) : PRECO_ETANOL / combinado(m.etanol)
}
export function pearson(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((s, x) => s + x, 0) / n
  const mb = b.reduce((s, x) => s + x, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) ** 2
    sbb += (b[i] - mb) ** 2
  }
  return sab / Math.sqrt(saa * sbb)
}
export function brl(n: number): string {
  return 'R$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
export function brl2(n: number): string {
  return 'R$ ' + n.toFixed(2).replace('.', ',')
}
export function kml(n: number): string {
  return n.toFixed(1).replace('.', ',')
}
