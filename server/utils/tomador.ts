import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Payer data (CPF/CNPJ and name) needed to issue the NFS-e. Stored only
// encrypted (AES-256-GCM) in pedidos_tomador. Never log the document or name.

function chaveBuf(chaveB64: string): Buffer {
  const k = Buffer.from(String(chaveB64 || ''), 'base64')
  if (k.length !== 32) throw new Error('invalid key')
  return k
}

/** v1.<iv b64>.<tag b64>.<dados b64> */
export function cifrar(texto: string, chaveB64: string): string {
  const key = chaveBuf(chaveB64)
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([c.update(String(texto), 'utf8'), c.final()])
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join('.')
}

export function decifrar(cifrado: string, chaveB64: string): string {
  const key = chaveBuf(chaveB64)
  const [v, iv, tag, data] = String(cifrado).split('.')
  if (v !== 'v1' || !iv || !tag || data === undefined) throw new Error('formato invalido')
  const ivB = Buffer.from(iv, 'base64')
  const tagB = Buffer.from(tag, 'base64')
  if (ivB.length !== 12 || tagB.length !== 16) throw new Error('formato invalido')
  const d = createDecipheriv('aes-256-gcm', key, ivB, { authTagLength: 16 })
  d.setAuthTag(tagB)
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8')
}

function dv(digs: number[], pesos: number[]): number {
  const s = pesos.reduce((a, p, i) => a + digs[i] * p, 0)
  const r = s % 11
  return r < 2 ? 0 : 11 - r
}

export function validarDocumento(doc: unknown): { tipo: 'CPF' | 'CNPJ'; digitos: string } | null {
  const digitos = String(doc ?? '').replace(/\D/g, '')
  if (!/^\d{11}$|^\d{14}$/.test(digitos) || /^(\d)\1+$/.test(digitos)) return null
  const n = digitos.split('').map(Number)
  if (digitos.length === 11) {
    const d1 = dv(n, [10, 9, 8, 7, 6, 5, 4, 3, 2])
    const d2 = dv(n, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
    return d1 === n[9] && d2 === n[10] ? { tipo: 'CPF', digitos } : null
  }
  const d1 = dv(n, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = dv(n, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === n[12] && d2 === n[13] ? { tipo: 'CNPJ', digitos } : null
}

function chavePadrao(): string {
  try { return String(useRuntimeConfig().tomadorKey || '') } catch { return '' }
}

export async function gravarTomador(
  supabase: any,
  pedidoId: string,
  d: { documento: string | null | undefined; nome?: string | null; origem: string },
  chaveB64?: string,
): Promise<boolean> {
  try {
    const chave = chaveB64 ?? chavePadrao()
    if (!chave) return false
    const doc = validarDocumento(d.documento)
    if (!doc) return false
    const nome = String(d.nome ?? '').trim()
    const { error } = await supabase.from('pedidos_tomador').upsert({
      pedido_id: pedidoId,
      documento_cifrado: cifrar(doc.digitos, chave),
      nome_cifrado: nome ? cifrar(nome, chave) : null,
      tipo: doc.tipo,
      origem: d.origem,
    }, { onConflict: 'pedido_id' })
    return !error
  } catch (e: any) {
    console.warn('[tomador] nao gravado:', String(e?.name || 'erro'))
    return false
  }
}

export async function lerTomador(
  supabase: any,
  pedidoId: string,
  chaveB64?: string,
): Promise<{ documento: string; nome: string | null; tipo: 'CPF' | 'CNPJ' } | null> {
  try {
    const chave = chaveB64 ?? chavePadrao()
    if (!chave) return null
    const { data, error } = await supabase.from('pedidos_tomador')
      .select('documento_cifrado, nome_cifrado, tipo').eq('pedido_id', pedidoId).maybeSingle()
    if (error || !data?.documento_cifrado) return null
    return {
      documento: decifrar(data.documento_cifrado, chave),
      nome: data.nome_cifrado ? decifrar(data.nome_cifrado, chave) : null,
      tipo: data.tipo,
    }
  } catch {
    return null
  }
}
