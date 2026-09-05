import { describe, it, expect, vi, beforeEach } from 'vitest'

// O que importa aqui e o DEDUPE: um bot em loop bate no teto centenas de vezes,
// e sem a janela de uma hora o alerta viraria spam e ninguem leria mais.
const enviados: any[] = []
vi.stubGlobal('sendErrorEmail', async (d: any) => { enviados.push(d) })

const { avisarAbuso } = await import('./alerta-abuso')

describe('avisarAbuso', () => {
  beforeEach(() => { enviados.length = 0 })

  it('manda uma vez e cala pelas repeticoes seguintes do mesmo IP', async () => {
    await avisarAbuso({ ip: '1.2.3.4', rota: '/api/consulta', teto: 15 })
    await avisarAbuso({ ip: '1.2.3.4', rota: '/api/consulta', teto: 15 })
    await avisarAbuso({ ip: '1.2.3.4', rota: '/api/consulta', teto: 15 })
    expect(enviados).toHaveLength(1)
  })

  it('IP diferente e alerta diferente', async () => {
    await avisarAbuso({ ip: '5.6.7.8', rota: '/api/consulta', teto: 15 })
    await avisarAbuso({ ip: '9.9.9.9', rota: '/api/premium/preview', teto: 15 })
    expect(enviados).toHaveLength(2)
  })

  it('leva IP, e-mail e contagem no corpo, e nada alem disso', async () => {
    await avisarAbuso({ ip: '2.2.2.2', rota: '/api/consulta', teto: 15, email: 'abuso@exemplo.com', bloqueiosNaHora: 42 })
    const msg = enviados[0].errorMessage
    expect(msg).toContain('2.2.2.2')
    expect(msg).toContain('abuso@exemplo.com')
    expect(msg).toContain('42')
    expect(enviados[0].ip).toBe('2.2.2.2')
  })

  it('sem e-mail informado, diz isso em vez de deixar buraco', async () => {
    await avisarAbuso({ ip: '3.3.3.3', rota: '/api/consulta', teto: 15 })
    expect(enviados[0].errorMessage).toContain('Sem e-mail informado')
  })
})
