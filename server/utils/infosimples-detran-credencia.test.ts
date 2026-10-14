import { describe, it, expect } from 'vitest'
import { blocoDetranDaUf, sanearBlocoMultas, CAMPOS_MULTA_PERMITIDOS, DETRAN_UFS } from './infosimples-detran'
import SC from './__fixtures__/infosimples-detran-sc.json'
import MG from './__fixtures__/infosimples-detran-mg.json'
import BA from './__fixtures__/infosimples-detran-ba.json'
import RS from './__fixtures__/infosimples-detran-rs.json'
import GO from './__fixtures__/infosimples-detran-go.json'
import PR from './__fixtures__/infosimples-detran-pr.json'
import DF from './__fixtures__/infosimples-detran-df.json'
import CE from './__fixtures__/infosimples-detran-ce.json'
import PA from './__fixtures__/infosimples-detran-pa-veiculo.json'
import AM from './__fixtures__/infosimples-detran-am.json'
import PE from './__fixtures__/infosimples-detran-pe.json'
import ES from './__fixtures__/infosimples-detran-es.json'
import MA from './__fixtures__/infosimples-detran-ma.json'
import AC from './__fixtures__/infosimples-detran-ac.json'

// Credenciamento SERPRO/Credencia 10959/2026 (01/out): a Politica promete que
// da infracao so saem data, hora, local, municipio/UF, orgao autuador,
// descricao, valor e vencimento das infracoes EM ABERTO. Nada do condutor nem
// do proprietario, nada de pontuacao nem de medicao (velocidade, etilometro), e
// infracao paga descartada (nem contagem). Este teste injeta tudo isso nos
// dados brutos de cada UF e prova que nada atravessa pro bloco gravado.
const PROIBIDO = /velocidade|pontos|pontuacao|grupo_infracao|condutor|responsavel|proprietario|cpf|cnh|etilometro|historico_infracoes|pagas|numero_auto|codigo_renainf|situacao_infracao/i

// Uma infracao "suja" com todo campo proibido que as UFs costumam mandar.
const sujo = {
  ait: 'X1', numero_auto: 'X1', auto: 'X1', serie: 'X1', auto_infracao: 'X1',
  descricao: 'AVANCAR SINAL', data_infracao: '01/02/2026', hora_infracao: '10:30', local: 'AV TESTE', municipio: 'CIDADE',
  orgao_autuador: 'DETRAN', valor: 'R$ 293,47', normalizado_valor: 293.47, valor_corrigido: 293.47, data_vencimento: '10/11/2026',
  velocidade_permitida: 60, velocidade_aferida: 90, pontos: 7, pontos_infracao: 7, pontuacao: 7, grupo_infracao: 'GRAVISSIMA',
  responsavel_infracao: 'CONDUTOR', nome_condutor: 'FULANO CONDUTOR', cpf_condutor: '123.456.789-00', data_limite_apresentacao_condutor: '01/03/2026',
  proprietario: 'CICRANO DONO', situacao: 'Paga', codigo_renainf: '999', tipo: 'multa-paga',
}

const BRUTOS: Record<string, any> = {
  SP: { debitos_multas: [{ ...sujo }], multas_total: '293.47' },
  SC: { ...SC, multas: [{ ...sujo, num_auto: 'X1', valor_multa: 'R$ 293,47' }], historico_infracoes_notificadas: [{ status: 'Paga' }] },
  MG: { ...MG, multas: [{ ...sujo }] },
  BA: { ...BA, infracoes: [{ ...sujo, numero_controle: 'C1' }], infracoes_detalhes: [{ ...sujo, codigo_controle: 'C1' }] },
  RS: { ...RS, infracoes: [{ ...sujo, situacao: 'Vencida em 10/10/2026' }, { ...sujo, situacao: 'Paga' }] },
  GO: { ...GO, infracoes: { vencidas: [{ ...sujo }], sob_juice: [{ ...sujo }] } },
  PR: [...PR, { ...sujo, tipo: 'multa-em-aberto' }],
  DF: { ...DF, debitos: { ...DF.debitos, infracoes_veiculo: [{ ...sujo }] } },
  CE: { ...CE, multas: [{ ...sujo }], multas_judice: [{ ...sujo }] },
  PA: { ...PA, infracoes: [{ ...sujo, data_hora: '01/02/202610:30', pontos_gravidade: '7 - GRAVISSIMA', status: 'A PAGAR' }, { ...sujo, status: 'PAGO' }] },
  AM: { ...AM, multas: [{ ...sujo }] },
  PE: { ...PE, debitos: { ...PE.debitos, multas: [{ ...sujo }] } },
  ES: { ...ES, multas: [{ ...sujo }], recursos: [{ ...sujo }] },
  MA: { ...MA, penalidades: { listagem: [{ ...sujo }] } },
  AC: { ...AC, infracoes: { vencidas: [{ ...sujo }], sub_judice: [{ ...sujo }] } },
  AL: { infracoes: [{ ...sujo }], normalizado_total: 293.47 },
  PI: { multas: [{ ...sujo, status: 'Em aberto' }] },
  RR: { infracoes: { detalhes_infracoes: [{ ...sujo }], valor_normalizado: 293.47 } },
  RO: { debitos_veiculo: { multas: [{ ...sujo }], normalizado_total_multas: 293.47 }, restricoes: [], status: 'Em Circulação' },
  RN: { multas: [{ ...sujo, numero_autuacao: 'X1', usuario: 'FULANO CONDUTOR' }], debitos: [{ classe: 'X1', valor_atual: 293.47 }], situacao: 'Em Circulação' },
}

describe('credenciamento: nenhum campo proibido sai do bloco DETRAN (todas as UFs do mapa)', () => {
  it('cobre todas as UFs do mapa', () => {
    expect(Object.keys(BRUTOS).sort()).toEqual(Object.keys(DETRAN_UFS).sort())
  })
  for (const uf of Object.keys(BRUTOS)) {
    it(`${uf}: itens e recursos so com campos permitidos; sem historico de pagas`, () => {
      const b: any = blocoDetranDaUf(uf as any, BRUTOS[uf])
      expect(b.historico_infracoes).toBeUndefined()
      for (const lista of [b.multas_itens || [], b.multas_em_recurso || []]) {
        for (const item of lista) {
          for (const k of Object.keys(item)) expect(CAMPOS_MULTA_PERMITIDOS as readonly string[]).toContain(k)
        }
      }
      const json = JSON.stringify({ itens: b.multas_itens, recursos: b.multas_em_recurso, hist: b.historico_infracoes })
      // Chave do JSON ("auto":) e permitida (decisao do Cesar, 01/out); as
      // chaves brutas do Infosimples (numero_auto, ait...) nao.
      expect(json.replace(/"auto":/g, '')).not.toMatch(PROIBIDO)
      if (b.multas_itens?.length) expect(b.multas_itens[0].auto).toBe('X1')
      expect(json).not.toContain('FULANO')
      expect(json).not.toContain('CICRANO')
      expect(json).not.toContain('123.456.789')
    })
  }
  it('PR: multa paga nao aparece nem conta', () => {
    const b: any = blocoDetranDaUf('PR', PR)
    expect(b.multas_itens).toEqual([])
    expect(JSON.stringify(b)).not.toMatch(/pagas|historico/)
  })
  it('saneador limpa snapshot antigo (o que o report.get serve)', () => {
    const antigo = {
      fonte: 'detran_go', status: 'ok',
      multas_itens: [{ auto: 'A1', descricao: 'X', valor: 1, pontos: 7, grupo: 'MEDIA', situacao: 'Vencida' }],
      historico_infracoes: { total: 10, pagas: 10, recursos: 0 },
    }
    const b: any = sanearBlocoMultas(antigo)
    expect(b.multas_itens).toEqual([{ auto: 'A1', descricao: 'X', valor: 1 }])
    expect(b.historico_infracoes).toBeUndefined()
  })
})
