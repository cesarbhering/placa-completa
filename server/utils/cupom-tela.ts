import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import { aplicarCupom, type PlanoId } from '../../shared/planos'
import { CUPOM_TELA_PCT, CUPOM_TELA_JANELA_MS } from '../../shared/cupom-tela'

// Cupom de tela (Cesar, 04/nov/2026): quem recebe o resultado da consulta
// gratis ganha 10% se fechar em 30 minutos. A urgencia e REAL: o servidor
// assina o instante da emissao (HMAC) e o checkout so aplica o desconto dentro
// da janela. Nao ha linha em cupons_premium: o token e a prova, e o pedido
// sai marcado com cupom_origem = 'cupom_tela'.
//
// Nao acumula com cupom de e-mail: vale o MAIOR (resolverDescontoTela).
// Reconsultar a mesma placa do mesmo IP nao reinicia o relogio (memoria do
// processo, 24 h): sem isso, F5 virava contador infinito.

export { CUPOM_TELA_PCT, CUPOM_TELA_JANELA_MS }

const VERSAO = 'v1'
/** Relogio do servidor adiantado/atrasado entre containers: tolerancia curta. */
const TOLERANCIA_FUTURO_MS = 60 * 1000
const MEMORIA_MS = 24 * 60 * 60 * 1000
const MEMORIA_MAX = 20000

/**
 * Segredo do HMAC. NUXT_CUPOM_TELA_SECRET quando existir; sem ele, derivado da
 * service key do banco premium (sempre presente onde ha checkout, nunca vai
 * pro navegador). Sem nenhum dos dois, string vazia = recurso desligado.
 */
export function segredoCupomTela(config: { cupomTelaSecret?: string; premiumSupabaseKey?: string }): string {
  if (config.cupomTelaSecret) return String(config.cupomTelaSecret)
  if (config.premiumSupabaseKey) return createHmac('sha256', String(config.premiumSupabaseKey)).update('cupom-tela-v1').digest('hex')
  return ''
}

function placaLimpa(placa: string): string {
  return String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}

function assinar(segredo: string, placa: string, emitidoEm: number): string {
  return createHmac('sha256', segredo).update(`${VERSAO}|${placaLimpa(placa)}|${emitidoEm}`).digest('base64url')
}

export function gerarTokenCupomTela(segredo: string, placa: string, emitidoEm: number): string {
  return `${VERSAO}.${emitidoEm}.${assinar(segredo, placa, emitidoEm)}`
}

export interface CupomTelaEmitido { token: string; expiraEm: string }

// Primeira emissao por (ip, placa). Hash pra nao guardar IP cru em memoria.
const primeiraEmissao = new Map<string, number>()

function chaveMemoria(ip: string, placa: string): string {
  return createHash('sha256').update(`${ip}|${placaLimpa(placa)}`).digest('base64url')
}

function limparMemoria(agora: number) {
  if (primeiraEmissao.size < MEMORIA_MAX) return
  for (const [k, t] of primeiraEmissao) if (agora - t > MEMORIA_MS) primeiraEmissao.delete(k)
  // Ainda cheio (ataque de volume): descarta os mais antigos (Map preserva a ordem de insercao).
  while (primeiraEmissao.size >= MEMORIA_MAX) {
    const k = primeiraEmissao.keys().next().value
    if (k === undefined) break
    primeiraEmissao.delete(k)
  }
}

/** So pros testes. */
export function _zerarMemoriaCupomTela() { primeiraEmissao.clear() }

/**
 * Token pra tela de resultado. Devolve null quando o recurso esta desligado ou
 * quando esta pessoa ja gastou a janela desta placa nas ultimas 24 h.
 */
export function emitirCupomTela(segredo: string, placa: string, ip: string, agora = Date.now()): CupomTelaEmitido | null {
  if (!segredo || placaLimpa(placa).length !== 7) return null
  limparMemoria(agora)
  const chave = chaveMemoria(ip || '', placa)
  const anterior = primeiraEmissao.get(chave)
  const emitidoEm = anterior && agora - anterior < MEMORIA_MS ? anterior : agora
  if (emitidoEm === agora) {
    primeiraEmissao.delete(chave)
    primeiraEmissao.set(chave, agora)
  }
  const expira = emitidoEm + CUPOM_TELA_JANELA_MS
  if (expira <= agora) return null
  return { token: gerarTokenCupomTela(segredo, placa, emitidoEm), expiraEm: new Date(expira).toISOString() }
}

/** true = token assinado por nos, para esta placa, dentro da janela de 30 min. */
export function cupomTelaValido(segredo: string, token: unknown, placa: string, agora = Date.now()): boolean {
  if (!segredo || typeof token !== 'string' || token.length > 200) return false
  const partes = token.split('.')
  if (partes.length !== 3 || partes[0] !== VERSAO || !/^\d{10,16}$/.test(partes[1])) return false
  const emitidoEm = Number(partes[1])
  if (emitidoEm > agora + TOLERANCIA_FUTURO_MS) return false
  if (agora - emitidoEm > CUPOM_TELA_JANELA_MS) return false
  const esperado = Buffer.from(assinar(segredo, placa, emitidoEm))
  const recebido = Buffer.from(partes[2])
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}

export interface DescontoTela { precoBrutoCentavos: number; descontoCentavos: number; precoLiquidoCentavos: number }

/** Preco com os 10% de tela (piso do plano respeitado, nunca zera). */
export function precoComCupomTela(plano: Exclude<PlanoId, 'gratis'>): DescontoTela {
  return aplicarCupom(plano, { tipo: 'percentual', valor: CUPOM_TELA_PCT, planos: ['basica', 'completa'] })
}

/**
 * Nao acumula: entre o cupom digitado/da URL e o de tela, vale o MAIOR
 * desconto. Empate fica com o cupom (que tem linha de uso e regra propria).
 * Quando a tela vence, o cupom some (nao registra uso nem marca o pedido).
 */
export function resolverDescontoTela<C extends { ok: boolean; descontoCentavos: number }>(
  plano: Exclude<PlanoId, 'gratis'>,
  cupom: C | null,
  telaOk: boolean,
): { cupom: C | null; tela: DescontoTela | null } {
  if (!telaOk) return { cupom, tela: null }
  const tela = precoComCupomTela(plano)
  if (cupom?.ok && cupom.descontoCentavos >= tela.descontoCentavos) return { cupom, tela: null }
  return { cupom: null, tela }
}

/** Colunas do pedido quando o desconto de tela foi o aplicado. */
export function colunasCupomTela(tela: DescontoTela | null): { cupom_origem?: string } {
  return tela ? { cupom_origem: 'cupom_tela' } : {}
}
