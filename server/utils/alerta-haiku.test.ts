import { describe, it, expect, beforeEach, vi } from 'vitest'
import { alertarFalhaHaiku, _zerarAlertaHaiku, JANELA_ALERTA_HAIKU_MS, DESTINO_ALERTA_HAIKU } from './alerta-haiku'

const PROD = { resendApiKey: 'x', public: {}, supabaseUrl: 'https://fivalpkfneadngxiflea.supabase.co' }

describe('alerta de falha do Haiku (FIPE)', () => {
  beforeEach(() => _zerarAlertaHaiku())

  it('manda o 1o, segura os seguintes por 60 min e agrega a contagem no proximo', async () => {
    const enviados: any[] = []
    let agora = 1_000_000
    const deps = { config: PROD, agora: () => agora, enviar: async (m: any) => { enviados.push(m) } }
    const f = (token: string) => ({ motivo: 'timeout 5000 ms', modelo: 'claude-haiku-5-5', token })

    expect(await alertarFalhaHaiku(f('tokA'), deps)).toBe(true)
    agora += 10 * 60 * 1000
    expect(await alertarFalhaHaiku(f('tokB'), deps)).toBe(false)
    agora += 30 * 60 * 1000
    expect(await alertarFalhaHaiku(f('tokC'), deps)).toBe(false)
    expect(enviados).toHaveLength(1)

    agora = 1_000_000 + JANELA_ALERTA_HAIKU_MS
    expect(await alertarFalhaHaiku(f('tokD'), deps)).toBe(true)
    expect(enviados).toHaveLength(2)
    expect(enviados[1].subject).toContain('(3x)')
    expect(enviados[1].text).toContain('desde o ultimo aviso: 3')
    expect(enviados[1].text).toContain('tokB, tokC, tokD')
    expect(enviados[0].to).toEqual([DESTINO_ALERTA_HAIKU])
  })

  it('janela e por motivo: outro motivo manda na hora', async () => {
    const enviados: any[] = []
    const deps = { config: PROD, agora: () => 5_000, enviar: async (m: any) => { enviados.push(m) } }
    await alertarFalhaHaiku({ motivo: 'timeout 5000 ms', modelo: 'm', token: 't1' }, deps)
    await alertarFalhaHaiku({ motivo: 'HTTP 400 invalid_request_error', detalhe: '`temperature` is deprecated', modelo: 'm', token: 't2' }, deps)
    await alertarFalhaHaiku({ motivo: 'timeout 5000 ms', modelo: 'm', token: 't3' }, deps)
    expect(enviados.map((m) => m.subject)).toEqual(['[FIPE] Haiku falhou: timeout 5000 ms', '[FIPE] Haiku falhou: HTTP 400 invalid_request_error'])
  })

  it('conteudo: motivo, modelo, horario e token; nada de placa', async () => {
    const enviados: any[] = []
    await alertarFalhaHaiku({ motivo: 'sem bloco text', detalhe: 'stop_reason=max_tokens', modelo: 'claude-haiku-5-5', token: 'TokFicticioTeste0000001' },
      { config: PROD, agora: () => Date.UTC(2026, 9, 10, 21, 0), enviar: async (m: any) => { enviados.push(m) } })
    const t = enviados[0].text
    expect(t).toContain('Motivo: sem bloco text')
    expect(t).toContain('Modelo: claude-haiku-5-5')
    expect(t).toContain('Horario: 10/10/2026, 18:00:00 BRT')
    expect(t).toContain('Pedido (token): TokFicticioTeste0000001')
    expect(t).not.toContain('—')
  })

  it('envio que falha libera o proximo e guarda a contagem', async () => {
    let falha = true
    const enviados: any[] = []
    const deps = { config: PROD, agora: () => 1, enviar: async (m: any) => { if (falha) throw new Error('resend fora'); enviados.push(m) } }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await alertarFalhaHaiku({ motivo: 'erro de rede', modelo: 'm', token: 'a' }, deps)).toBe(false)
    falha = false
    expect(await alertarFalhaHaiku({ motivo: 'erro de rede', modelo: 'm', token: 'b' }, deps)).toBe(true)
    expect(enviados[0].subject).toContain('(2x)')
  })

  it('fora de prod nao manda', async () => {
    const enviar = vi.fn(async () => {})
    expect(await alertarFalhaHaiku({ motivo: 'timeout 5000 ms', modelo: 'm' }, { config: { ...PROD, public: { homolog: true } }, enviar })).toBe(false)
    expect(enviar).not.toHaveBeenCalled()
  })
})
