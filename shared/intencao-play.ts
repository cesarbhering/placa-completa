// Compra no app (Google Play): o e-mail chega ao servidor ANTES do pagamento.
//
// Antes o e-mail so chegava depois de pagar (POST /verificar). Se o app morria
// logo depois do pagamento, a RTDN criava o pedido sem e-mail. Agora o checkout
// do app grava { placa, email } em /api/premium/google-play/intencao e manda o
// id devolvido (nao a placa) como obfuscatedExternalAccountId da compra. O
// servidor le esse id na Google e recupera placa e e-mail de qualquer caminho
// (app, RTDN, job).
//
// O id e opaco (nada de placa ou e-mail dentro) e cabe no limite de 64
// caracteres da Play.

export const PREFIXO_INTENCAO = 'gpi_'
const RE_ID_INTENCAO = /^gpi_[A-Za-z0-9_-]{16,60}$/

export function ehIdIntencao(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 64 && RE_ID_INTENCAO.test(v)
}

export function emailValido(v: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim())
}
