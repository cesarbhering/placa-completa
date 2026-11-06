import { describe, it, expect, vi } from 'vitest'
import {
  tokenFeedbackPlausivel, normalizarResposta, registrarNota, registrarComentario, caminhoDaNota, montarAlertaNotaBaixa, gerarTokenFeedback, linkFeedback,
} from './feedback'

describe('token do link de feedback', () => {
  it('aceita token longo do e-mail', () => {
    expect(tokenFeedbackPlausivel('fb_7c2a91be4d0f38a5c1e6')).toBe(true)
  })
  it('recusa token curto: e chute, nao link truncado', () => {
    expect(tokenFeedbackPlausivel('abc123')).toBe(false)
  })
  it('recusa caractere estranho antes de tocar no banco', () => {
    expect(tokenFeedbackPlausivel("' or 1=1 --aaaaaaaaaaaaaaa")).toBe(false)
  })
  it('recusa vazio', () => {
    expect(tokenFeedbackPlausivel(undefined)).toBe(false)
  })
})

describe('resposta da pesquisa', () => {
  it('nota valida com comentario', () => {
    expect(normalizarResposta({ nota: 5, comentario: '  muito bom  ' }))
      .toEqual({ nota: 5, comentario: 'muito bom' })
  })
  it('comentario e opcional', () => {
    expect(normalizarResposta({ nota: 3, comentario: '   ' })).toEqual({ nota: 3, comentario: null })
  })
  it('nota fora da escala nao passa', () => {
    expect(normalizarResposta({ nota: 0 })).toHaveProperty('erro')
    expect(normalizarResposta({ nota: 6 })).toHaveProperty('erro')
    expect(normalizarResposta({ nota: 4.5 })).toHaveProperty('erro')
    expect(normalizarResposta({})).toHaveProperty('erro')
  })
  it('comentario gigante e cortado, nao recusado: a nota importa mais', () => {
    const r: any = normalizarResposta({ nota: 2, comentario: 'x'.repeat(5000) })
    expect(r.nota).toBe(2)
    expect(r.comentario).toHaveLength(2000)
  })
})

const TOKEN = 'fb_TOKENFICTICIO1234567890'

// Banco de mentira de uma linha de feedback_solicitacoes, com as travas do
// update condicionado (is null / lte) funcionando de verdade.
function banco(linha: any) {
  return {
    linha,
    from() {
      const conds: ((r: any) => boolean)[] = []
      let upd: any = null
      const q: any = {
        select: () => q,
        update: (u: any) => { upd = u; return q },
        eq: (c: string, v: any) => { conds.push((r) => r[c] === v); return q },
        is: (c: string, v: any) => { conds.push((r) => (r[c] ?? null) === v); return q },
        lte: (c: string, v: any) => { conds.push((r) => r[c] != null && r[c] <= v); return q },
        maybeSingle: async () => ({ data: linha && conds.every((f) => f(linha)) ? { ...linha } : null }),
        then: (res: any) => {
          const ok = linha && conds.every((f) => f(linha))
          if (ok && upd) Object.assign(linha, upd)
          res({ data: ok ? [{ ...linha }] : [], error: null })
        },
      }
      return q
    },
  }
}
const nova = () => ({ token: TOKEN, placa: 'AAA1A11', nota: null, comentario: null, respondido_em: null })

describe('nota pelo e-mail', () => {
  it('4 e 5 vao para o Google; 1 a 3 para o "o que melhorar"', () => {
    expect(caminhoDaNota(5)).toBe('google')
    expect(caminhoDaNota(4)).toBe('google')
    expect(caminhoDaNota(3)).toBe('melhorar')
    expect(caminhoDaNota(1)).toBe('melhorar')
  })
  it('token gerado e plausivel e o link leva a nota', () => {
    const t = gerarTokenFeedback()
    expect(tokenFeedbackPlausivel(t)).toBe(true)
    expect(linkFeedback('https://placacompleta.com.br/', t, 5)).toBe(`https://placacompleta.com.br/feedback/${t}?nota=5`)
  })
  it('caminho nota 5: grava uma vez; clicar de novo (em outra nota) devolve a 5', async () => {
    const b = banco(nova())
    const r1 = await registrarNota(b, TOKEN, 5)
    expect(r1).toMatchObject({ existe: true, nota: 5, gravadaAgora: true })
    expect(b.linha.respondido_em).toBeTruthy()
    const r2 = await registrarNota(b, TOKEN, 1)
    expect(r2).toMatchObject({ nota: 5, gravadaAgora: false })
    expect(b.linha.nota).toBe(5)
  })
  it('nota invalida nao grava', async () => {
    const b = banco(nova())
    expect(await registrarNota(b, TOKEN, 9)).toMatchObject({ nota: null, gravadaAgora: false })
  })
  it('token inexistente: existe=false', async () => {
    const b = banco(null)
    expect(await registrarNota(b, TOKEN, 5)).toMatchObject({ existe: false })
  })
  it('nota 4/5 nao aceita comentario (nao ha campo nesse caminho)', async () => {
    const b = banco({ ...nova(), nota: 5, respondido_em: 'x' })
    const avisar = vi.fn(async () => {})
    expect(await registrarComentario(b, TOKEN, 'oi', avisar)).toEqual({ ok: true, motivo: 'ja_registrado' })
    expect(b.linha.comentario).toBeNull()
    expect(avisar).not.toHaveBeenCalled()
  })
})

describe('comentario de nota baixa', () => {
  it('caminho nota 2: grava o comentario e avisa o Lead sem e-mail do cliente', async () => {
    const b = banco({ ...nova(), email: 'cliente@exemplo.com', nota: 2, respondido_em: 'x' })
    const avisar = vi.fn(async (_m: any) => {})
    expect(await registrarComentario(b, TOKEN, '  faltou multa  ', avisar)).toEqual({ ok: true })
    expect(b.linha.comentario).toBe('faltou multa')
    expect(avisar).toHaveBeenCalledTimes(1)
    const msg = avisar.mock.calls[0][0]
    expect(msg.subject).toBe('Feedback do premium: nota 2')
    expect(msg.text).toContain('faltou multa')
    expect(msg.text).toContain(TOKEN)
    expect(msg.subject + msg.text).not.toContain('@')
  })
  it('segunda vez nao sobrescreve nem avisa de novo', async () => {
    const b = banco({ ...nova(), nota: 1, respondido_em: 'x' })
    const avisar = vi.fn(async () => {})
    await registrarComentario(b, TOKEN, 'primeiro', avisar)
    await registrarComentario(b, TOKEN, 'segundo', avisar)
    expect(b.linha.comentario).toBe('primeiro')
    expect(avisar).toHaveBeenCalledTimes(1)
  })
  it('nota 3 grava o comentario sem avisar o Lead', async () => {
    const b = banco({ ...nova(), nota: 3, respondido_em: 'x' })
    const avisar = vi.fn(async () => {})
    expect(await registrarComentario(b, TOKEN, 'ok', avisar)).toEqual({ ok: true })
    expect(b.linha.comentario).toBe('ok')
    expect(avisar).not.toHaveBeenCalled()
  })
  it('vazio e recusado', async () => {
    expect(await registrarComentario(banco(nova()), TOKEN, '   ', async () => {})).toEqual({ ok: false, motivo: 'vazio' })
  })
  it('alerta: so nota, comentario e token', () => {
    expect(montarAlertaNotaBaixa({ nota: 1, comentario: 'x', token: TOKEN }).text).toBe(`Nota: 1\n\nComentário:\nx\n\nToken: ${TOKEN}`)
  })
})
