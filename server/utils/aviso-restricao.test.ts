// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { avisarRestricaoSemCopy, _resetarAvisoRestricao, DESTINO_AVISO_RESTRICAO } from './aviso-restricao'

const config = { resendApiKey: 'k', public: {}, supabaseUrl: 'https://fivalpkfneadngxiflea.supabase.co' }
const resp = (itens: string[]) => [{ restricoes: { items: itens.map((t) => ({ tipoRestricao: t })) } }]
const DIA = Date.UTC(2026, 9, 14, 15)

describe('aviso de restricao sem copy', () => {
  beforeEach(() => _resetarAvisoRestricao())

  it('codigo sem copy: 1 e-mail pra helena@ com a chave e a placa; repetido no mesmo dia nao manda', async () => {
    const enviar = vi.fn(async () => {})
    expect(await avisarRestricaoSemCopy(resp(['CODIGO_INEDITO_X', 'ALTERACAO_DOC']), { placa: 'CYU7D91', token_entrega: 'TOK' }, { config, agora: DIA, enviar })).toBe(true)
    expect(enviar).toHaveBeenCalledTimes(1)
    const msg = (enviar.mock.calls[0] as any)[0]
    expect(msg.to).toEqual([DESTINO_AVISO_RESTRICAO])
    expect(msg.subject).toBe('Restrição sem copy própria: CODIGO_INEDITO_X (CYU7D91)')
    expect(msg.text).toContain('https://placacompleta.com.br/premium/TOK')
    expect(msg.text).not.toContain('—')
    expect(await avisarRestricaoSemCopy(resp(['CODIGO_INEDITO_X']), { placa: 'OUTRA1A1' }, { config, agora: DIA + 3600_000, enviar })).toBe(false)
    expect(enviar).toHaveBeenCalledTimes(1)
    // dia seguinte: avisa de novo
    expect(await avisarRestricaoSemCopy(resp(['CODIGO_INEDITO_X']), { placa: 'OUTRA1A1' }, { config, agora: DIA + 86400_000, enviar })).toBe(true)
  })

  it('tudo com copy (ou informativo): nao manda', async () => {
    const enviar = vi.fn(async () => {})
    expect(await avisarRestricaoSemCopy(resp(['ALTERACAO_DOC', 'SISTEMA_GNV', 'ALIENACAO_FIDUCIARIA']), { placa: 'X' }, { config, agora: DIA, enviar })).toBe(false)
    expect(enviar).not.toHaveBeenCalled()
  })

  it('fora de prod nao manda; envio que falha libera pra proxima', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const enviar = vi.fn(async () => {})
    const staging = { ...config, supabaseUrl: 'https://nqhlxsvggrumgcceamwg.supabase.co' }
    expect(await avisarRestricaoSemCopy(resp(['COD_Y']), { placa: 'X' }, { config: staging, agora: DIA, enviar })).toBe(false)
    const falha = vi.fn(async () => { throw new Error('resend fora') })
    expect(await avisarRestricaoSemCopy(resp(['COD_Y']), { placa: 'X' }, { config, agora: DIA, enviar: falha })).toBe(false)
    expect(await avisarRestricaoSemCopy(resp(['COD_Y']), { placa: 'X' }, { config, agora: DIA, enviar })).toBe(true)
  })
})
