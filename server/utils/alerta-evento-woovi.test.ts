// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const enviar = vi.fn(async (_dados: any) => {})
vi.mock('./sendErrorEmail', () => ({ sendErrorEmail: (dados: any) => enviar(dados) }))

const { avisarEventoEstranhoWoovi } = await import('./alerta-evento-woovi')

const PEDIDO = '11111111-1111-4111-8111-111111111111'
const HORA = 60 * 60 * 1000
let serie = 0
/** A correlationID of its own for each test: the deduplication lives in module memory. */
const novaCorrelacao = () => `${PEDIDO}-rteste${++serie}`
const evento = (correlationID: string) => ({ evento: 'OPENPIX:CHARGE_COMPLETED', correlationID, pedidoId: PEDIDO, motivo: 'nao_existe' as const })
const texto = () => JSON.stringify(enviar.mock.calls.map((c) => c[0]))

beforeEach(() => {
  enviar.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('avisarEventoEstranhoWoovi', () => {
  it('tells the team which event, which correlationID and which order', async () => {
    const correlationID = novaCorrelacao()

    expect(await avisarEventoEstranhoWoovi(evento(correlationID), 0)).toBe(true)

    expect(enviar).toHaveBeenCalledTimes(1)
    expect(texto()).toContain('OPENPIX:CHARGE_COMPLETED')
    expect(texto()).toContain(correlationID)
    expect(texto()).toContain(PEDIDO)
  })

  it('one alert per correlationID per hour', async () => {
    const correlationID = novaCorrelacao()

    expect(await avisarEventoEstranhoWoovi(evento(correlationID), 0)).toBe(true)
    expect(await avisarEventoEstranhoWoovi(evento(correlationID), 1000)).toBe(false)
    expect(await avisarEventoEstranhoWoovi(evento(correlationID), HORA - 1)).toBe(false)
    expect(enviar).toHaveBeenCalledTimes(1)

    expect(await avisarEventoEstranhoWoovi(evento(correlationID), HORA + 1)).toBe(true)
    expect(enviar).toHaveBeenCalledTimes(2)
  })

  it('another correlationID is another alert', async () => {
    expect(await avisarEventoEstranhoWoovi(evento(novaCorrelacao()), 0)).toBe(true)
    expect(await avisarEventoEstranhoWoovi(evento(novaCorrelacao()), 0)).toBe(true)

    expect(enviar).toHaveBeenCalledTimes(2)
  })

  it('text taken from the event reaches the e-mail without markup', async () => {
    await avisarEventoEstranhoWoovi({
      evento: 'OPENPIX:<b>CHARGE</b>',
      correlationID: `${PEDIDO}-r<img src=x onerror=alert(1)>`,
      pedidoId: PEDIDO,
      motivo: 'sem_correlacao_do_pedido',
    }, 0)

    expect(enviar).toHaveBeenCalledTimes(1)
    expect(texto()).not.toMatch(/[<>]/)
  })

  it('a very long correlationID is cut', async () => {
    await avisarEventoEstranhoWoovi(evento(`${novaCorrelacao()}${'a'.repeat(5000)}`), 0)

    expect(texto().length).toBeLessThan(1500)
  })

  it('a failure to send never reaches the caller, and the next event alerts again', async () => {
    const correlationID = novaCorrelacao()
    enviar.mockRejectedValueOnce(new Error('mail down'))

    expect(await avisarEventoEstranhoWoovi(evento(correlationID), 0)).toBe(false)
    expect(await avisarEventoEstranhoWoovi(evento(correlationID), 1000)).toBe(true)
  })
})
