import { describe, it, expect } from 'vitest'
import { LEILAO_FORA_DO_DOCUMENTO, leilaoSemOcorrencia, PALAVRAS_DE_ACUSACAO } from './leilao-copy'

const TODAS = [LEILAO_FORA_DO_DOCUMENTO, leilaoSemOcorrencia('esta moto')]

describe('copy da secao de leilao', () => {
  it('fala do documento, nao de quem o emite', () => {
    for (const frase of TODAS) {
      const baixa = frase.toLowerCase()
      for (const palavra of PALAVRAS_DE_ACUSACAO) {
        expect(baixa, `"${palavra}" acusa alguem de omitir`).not.toContain(palavra)
      }
      expect(baixa).not.toContain('detran')
    }
  })

  it('nunca afirma que o veiculo passou por leilao: fala de registro', () => {
    expect(LEILAO_FORA_DO_DOCUMENTO).toMatch(/registro/i)
    expect(LEILAO_FORA_DO_DOCUMENTO).toMatch(/pode não constar/i)
  })

  it('sem ocorrencia usa o nome do veiculo que veio do segmento', () => {
    expect(leilaoSemOcorrencia('esta moto')).toContain('esta moto')
    expect(leilaoSemOcorrencia('este veículo')).toContain('este veículo')
  })

  it('sem travessao em nenhuma frase', () => {
    for (const frase of TODAS) expect(frase).not.toContain('—')
  })
})

describe('so possivel (16/out/2026)', () => {
  it('resumo, parecer e cartao honestos, sem travessao nem acusacao', async () => {
    const { resumoSoPossivel, parecerComPossivel, cartaoSoPossivel, LEILAO_NIVEIS_RODAPE, PALAVRAS_DE_ACUSACAO } = await import('./leilao-copy')
    expect(resumoSoPossivel(1, 'este carro')).toBe('1 registro possível de leilão com perfil parecido com este carro. Pode ser outro veículo do mesmo modelo e ano: confira abaixo o que bate e o que não bate.')
    expect(resumoSoPossivel(2, 'este carro')).toMatch(/^2 registros possíveis .* Podem ser outro veículo/)
    expect(parecerComPossivel(1)).toBe(' Consta 1 registro possível de leilão, que pode ser outro veículo do mesmo modelo e ano (veja o Histórico de leilão).')
    expect(cartaoSoPossivel(1)).toBe('POSSÍVEL (1)')
    for (const t of [resumoSoPossivel(1, 'x'), parecerComPossivel(2), LEILAO_NIVEIS_RODAPE]) {
      expect(t).not.toContain('—')
      expect(t).not.toMatch(/nenhuma ocorrência/i)
      for (const w of PALAVRAS_DE_ACUSACAO) expect(t.toLowerCase()).not.toContain(w)
    }
  })
  it('template: "nenhuma ocorrencia" so sem possivel; mesmo conjunto na grade, parecer, checklist e linha do tempo', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const vue = readFileSync(join(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    expect(vue).toContain('<template v-if="!temIndicioReal && !possiveisComFoto.length && !possiveisSemFoto.length && !passagensNotificadas.length">')
    expect(vue).toContain('const leilaoPossivel = nPossiveisExibidos.value > 0')
    expect(vue).toContain('parecerComPossivel(nPossiveisExibidos.value)')
    expect(vue).toContain('valor = cartaoSoPossivel(nPossiveisExibidos.value)')
    expect((vue.match(/idxPossiveisExibidos\.value\.has\(i\)/g) || []).length).toBe(2)
  })
})
