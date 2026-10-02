import { lerPlacaCacheFresca } from './placa-lookup'

// Chassi que o SERVIDOR ja tem da consulta gratis (placa_cache), pros sinais de
// leilao e recall. Decisao do Cesar (01/out): o sinal nao usa mais o
// chassiParcial que o cliente manda. Em 78% das placas ele e o PREFIXO
// mascarado ("LJ11K*****"), que so identifica a montadora; e vir do body
// deixava o cliente escolher o chassi.
//
// Regras:
// - So le o cache (lerPlacaCacheFresca): nenhuma chamada nova a API paga.
// - completo = extra.chassi da WDAPI com 17 caracteres.
// - sufixo = chassi da raiz ja mascarado pela WDAPI ("*****00139"), quando nao
//   ha o completo. A leiloes-api trata como "provavel".
// - O chassi NUNCA sai pro cliente: quem chama so devolve o sinal.

export type ChassiServidor =
  | { tipo: 'completo'; chassi: string }
  | { tipo: 'sufixo'; chassi: string }
  | { tipo: null; chassi: null }

const NENHUM: ChassiServidor = { tipo: null, chassi: null }

export function chassiDoPayload(payload: any): ChassiServidor {
  if (!payload || typeof payload !== 'object') return NENHUM
  const completo = String(payload?.extra?.chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (completo.length === 17) return { tipo: 'completo', chassi: completo }
  const raiz = String(payload?.chassi || '').toUpperCase().replace(/\s/g, '')
  if (/^\*+[A-Z0-9]{4,}$/.test(raiz)) return { tipo: 'sufixo', chassi: raiz }
  return NENHUM
}

export async function chassiDoServidor(placa: string): Promise<ChassiServidor> {
  return chassiDoPayload(await lerPlacaCacheFresca(placa))
}
