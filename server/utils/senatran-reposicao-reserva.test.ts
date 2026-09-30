import { describe, it, expect, vi } from 'vitest'

// A reposicao da reserva GCC roda uma vez por venda, no sucesso E no erro.
// Antes so no sucesso: uma venda que falhava no SENATRAN (404 + fallback de
// placa, smoke do homolog 29/set) zerava a reserva ate o timer de 10 min.
const { comReposicaoDaReserva } = await import('./senatran-consulta')

describe('comReposicaoDaReserva', () => {
  it('repoe depois de uma venda que deu certo', async () => {
    const repor = vi.fn()
    await expect(comReposicaoDaReserva(async () => 'ok', repor)).resolves.toBe('ok')
    expect(repor).toHaveBeenCalledTimes(1)
  })

  it('repoe tambem quando a venda falha, e o erro original sobe intacto', async () => {
    const repor = vi.fn()
    const erro: any = new Error('SENATRAN retornou HTTP 404'); erro.http = 404
    await expect(comReposicaoDaReserva(async () => { throw erro }, repor)).rejects.toBe(erro)
    expect(repor).toHaveBeenCalledTimes(1)
  })

  it('falha no disparo da reposicao nunca muda o resultado da venda', async () => {
    const repor = vi.fn(() => { throw new Error('supabase fora') })
    await expect(comReposicaoDaReserva(async () => 42, repor)).resolves.toBe(42)
  })
})
