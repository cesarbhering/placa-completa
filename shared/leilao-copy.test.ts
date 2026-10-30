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
    const { resumoSoPossivel, parecerComPossivel, cartaoSoPossivel, PALAVRAS_DE_ACUSACAO } = await import('./leilao-copy')
    expect(resumoSoPossivel(1, 'este carro')).toBe('1 registro possível de leilão com perfil parecido com este carro. Pode ser outro veículo do mesmo modelo e ano: confira abaixo o que bate e o que não bate.')
    expect(resumoSoPossivel(2, 'este carro')).toMatch(/^2 registros possíveis .* Podem ser outro veículo/)
    expect(parecerComPossivel(1)).toBe(' Consta 1 registro possível de leilão, que pode ser outro veículo do mesmo modelo e ano (veja o Histórico de leilão).')
    expect(cartaoSoPossivel(1)).toBe('POSSÍVEL (1)')
    for (const t of [resumoSoPossivel(1, 'x'), parecerComPossivel(2)]) {
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
    expect(vue).toContain('nPossiveis: possiveisSemFoto.value.length > 0 ? nPossiveisExibidos.value : 0')
    expect((vue.match(/idxPossiveisExibidos\.value\.has\(i\)/g) || []).length).toBe(2)
  })
})

describe('possivel com foto (16/out/2026)', () => {
  it('o card do possivel distinto mostra as fotos em carrossel (27/out); o bloco de fotos fica so com os ambiguos', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const vue = readFileSync(join(process.cwd(), 'pages/premium/[token].vue'), 'utf8')
    expect(vue).toContain('<LoteCarrossel v-if="p.midias.length" :midias="p.midias" />')
    expect(vue).toContain('const possiveisSemFoto = computed(() => passagensPossiveis.value)')
    expect(vue).toContain('!distintos.has(p.idx)')
  })
})

describe('cartao de leilao: so possivel em amarelo (21/out/2026)', () => {
  it('so possivel: aceso, sem alerta e sem neutro (ambar), "POSSÍVEL (n)"', async () => {
    const { estadoCartaoLeilao } = await import('./leilao-copy')
    expect(estadoCartaoLeilao({ confirmado: 0, provavel: 0, notificado: 0, nPossiveis: 2, possiveisComFoto: 0 })).toEqual({ valor: 'POSSÍVEL (2)', alerta: false, aceso: true, neutro: false })
  })
  it('confirmado e provavel continuam vermelhos (alerta), mesmo com possivel junto', async () => {
    const { estadoCartaoLeilao } = await import('./leilao-copy')
    expect(estadoCartaoLeilao({ confirmado: 1, provavel: 0, notificado: 0, nPossiveis: 3, possiveisComFoto: 0 })).toMatchObject({ valor: 'CONSTA (1 confirmado)', alerta: true })
    expect(estadoCartaoLeilao({ confirmado: 0, provavel: 2, notificado: 0, nPossiveis: 1, possiveisComFoto: 0 })).toMatchObject({ valor: 'PROVÁVEL (2)', alerta: true })
  })
  it('so notificacao: cinza; nada: sem ocorrencia', async () => {
    const { estadoCartaoLeilao } = await import('./leilao-copy')
    expect(estadoCartaoLeilao({ confirmado: 0, provavel: 0, notificado: 1, nPossiveis: 0, possiveisComFoto: 0 })).toMatchObject({ neutro: true, alerta: false })
    expect(estadoCartaoLeilao({ confirmado: 0, provavel: 0, notificado: 0, nPossiveis: 0, possiveisComFoto: 0 })).toMatchObject({ valor: 'SEM OCORRÊNCIA', aceso: false })
  })
})

describe('secao de leilao enxuta (Cesar, 21/out/2026)', () => {
  it('sem card de sinistro, sem chips de nivel no topo e sem o rodape explicativo', async () => {
    const { readFileSync } = await import('node:fs')
    const vue = readFileSync('pages/premium/[token].vue', 'utf8')
    expect(vue).not.toContain('class="rel__sinistro"')
    expect(vue).not.toContain('ROTULO_NIVEL[nivelExibido]')
    expect(vue).not.toContain('Não substitui consulta oficial')
    expect(vue).not.toContain('Confirmado quer dizer placa ou chassi completos iguais')
    // o indicador de sinistro na grade e o selo de nivel por passagem continuam
    expect(vue).toContain("k: 'sinistroParceiro', label: 'Indício de sinistro'")
    expect(vue.match(/<LeilaoFicha :p="p" \/>/g) || []).toHaveLength(2)
    expect(readFileSync('components/LeilaoFicha.vue', 'utf8')).toContain('{{ p.rotuloNivel }}')
  })
})

describe('ficha: gravidade so com classificacao e pilula so para rotulo curto (21/out/2026)', () => {
  it('gravidadeInformada', async () => {
    const { gravidadeInformada } = await import('./leilao-exibicao')
    expect(gravidadeInformada({ nivel: 'media_monta', rotulo: 'Média monta' })).toBe(true)
    expect(gravidadeInformada({ nivel: 'sucata', rotulo: 'Sucata' })).toBe(true)
    expect(gravidadeInformada({ nivel: 'sinistro', rotulo: 'Sinistro (monta não informada)' })).toBe(false)
    expect(gravidadeInformada({ nivel: 'desconhecido', rotulo: 'Condição não informada' })).toBe(false)
    expect(gravidadeInformada({ nivel: 'desconhecido', rotulo: 'Qualquer' })).toBe(false)
    expect(gravidadeInformada(null)).toBe(false)
  })
  it('cabeEmPilula: ate 14 caracteres', async () => {
    const { cabeEmPilula } = await import('./leilao-exibicao')
    expect(cabeEmPilula('Confirmado')).toBe(true)
    expect(cabeEmPilula('Base parceira')).toBe(true)
    expect(cabeEmPilula('Bancos e Financeiras')).toBe(false)
    expect(cabeEmPilula('Sinistro (monta não informada)')).toBe(false)
  })
})
