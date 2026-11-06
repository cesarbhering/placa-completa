import { BASE_LEILAO_DUAS_BASES } from './base-leilao'

// English labels for the report features in shared/planos.ts (Nov 6, 2026),
// keyed by the PT label. shared/planos-en.test.ts fails when a feature is
// added in PT without its English line here.

const BASE_LEILAO_DUAS_BASES_EN = 'two databases cross-checked: ours, with more than 2 million records, and a premium partner database'

export const RECURSOS_EN: Record<string, string> = {
  'Marca, modelo, ano e cor': 'Make, model, year and color',
  'Combustível e origem': 'Fuel and origin',
  'Parte do chassi': 'Part of the VIN',
  'Chassi completo': 'Full VIN (chassis number)',
  'Valor FIPE': 'FIPE value (Brazilian market price table)',
  'FIPE com histórico de depreciação': 'FIPE value with depreciation history',
  'Seguro estimado e custo em 5 anos': 'Estimated insurance and 5-year cost of ownership',
  'Situação cadastral (em circulação / baixado)': 'Registration status (active or deregistered)',
  'Ficha técnica: espécie, tipo, categoria': 'Specs: vehicle class, type and category',
  'Potência, cilindrada, eixos e lotação': 'Power, engine size, axles and seating capacity',
  'Município e UF de jurisdição': 'City and state of registration',
  'Recall pendente': 'Open recalls',
  'Renavam completo': 'Full RENAVAM (national registry number)',
  'Informações de importação (veículos importados)': 'Import details (imported vehicles)',
  'Origem de fabricação pelo chassi': 'Country of manufacture from the VIN',
  'Restrições nacionais e estaduais': 'National and state restrictions',
  'Roubo e furto': 'Theft records',
  'Registro de leilão no documento': 'Auction record on the vehicle title',
  'Histórico de leilão': 'Auction history',
  'Indício de sinistro': 'Signs of a past insurance claim',
  'Gravame e alienação': 'Liens and financing',
  'RENAJUD e restrições judiciais': 'RENAJUD and court restrictions',
  'Indicador de multas (RENAINF)': 'Traffic fines indicator (RENAINF)',
  'Comunicação de venda': 'Notice of sale',
}

export const DETALHES_EN: Record<string, string> = {
  [BASE_LEILAO_DUAS_BASES]: BASE_LEILAO_DUAS_BASES_EN,
  'consulta em base parceira premium': 'checked against a premium partner database',
}
