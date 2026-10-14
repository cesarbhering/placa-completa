// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sanearBruto, brutoParaGravar, registrarCusto, TETO_BRUTO_BYTES } from './infosimples-detran'

const DIR = join(process.cwd(), 'server/utils/__fixtures__')
const FIXTURES = readdirSync(DIR).filter((f) => /^infosimples-detran-.*\.json$/.test(f))
// Chave que nunca pode sobrar no bruto gravado.
const PROIBIDA = /nome|propriet|cpf|cnpj|condutor|infrator|endereco|logradouro|telefone|email|receipt|url|pix|boleto|codigo_barras|login|senha/i

function chaves(o: any, acc: string[] = []): string[] {
  if (Array.isArray(o)) o.forEach((x) => chaves(x, acc))
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { acc.push(k); chaves(v, acc) }
  return acc
}

describe('bruto saneado (premium_custos.bruto)', () => {
  it(`fixtures reais (${FIXTURES.length}): nenhuma chave proibida sobra, dados do veiculo ficam`, () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(15)
    for (const f of FIXTURES) {
      const b = brutoParaGravar(JSON.parse(readFileSync(join(DIR, f), 'utf8')))
      const proibidas = chaves(b).filter((k) => PROIBIDA.test(k))
      expect({ f, proibidas }).toEqual({ f, proibidas: [] })
    }
  })

  it('PVT3J49 (ES): tira proprietario e receipt, mantem multas, debitos e recursos', () => {
    const es = JSON.parse(readFileSync(join(DIR, 'infosimples-detran-es-pvt3j49.json'), 'utf8'))
    const b = brutoParaGravar({ ...es, proprietario: 'NOME REAL', proprietario_anterior: 'OUTRO NOME', site_receipt: 'https://x' })
    const txt = JSON.stringify(b)
    for (const x of ['NOME REAL', 'OUTRO NOME', 'https://x', 'site_receipt']) expect(txt).not.toContain(x)
    expect(b.multas[0].numero_auto).toBe('PRF-000100-J004903355-7463/00')
    expect(b.debitos.some((d: any) => d.descricao === 'PRF-000100-J004903355-7463/00' && d.normalizado_atual === 199.29)).toBe(true)
    expect(b.recursos[0].situacao).toBe('Processo Deferido')
  })

  it('aninhado e em lista: CPF do condutor, URL de guia e Pix saem', () => {
    const b = sanearBruto({ infracoes: [{ ait: 'A1', cpf_condutor: '123', nome_condutor: 'X', guia_pagamento_url: 'u', codigo_pix: 'p', valor: 10 }] })
    expect(b).toEqual({ infracoes: [{ ait: 'A1', valor: 10 }] })
  })

  it('acima do teto: grava so a estrutura', () => {
    const grande = { lista: Array.from({ length: 5000 }, (_, i) => ({ texto: 'x'.repeat(80), i })) }
    const b = brutoParaGravar(grande)
    expect(b.truncado).toBe(true)
    expect(b.bytes).toBeGreaterThan(TETO_BRUTO_BYTES)
    expect(brutoParaGravar(null)).toBeNull()
  })

  it('registrarCusto grava o bruto; sem a coluna no banco, grava o custo assim mesmo', async () => {
    const linhas: any[] = []
    let semColuna = false
    const sb = { from: () => ({ insert: async (l: any) => { if (semColuna && 'bruto' in l) return { error: { message: 'column bruto does not exist' } }; linhas.push({ ...l }); return { error: null } } }) }
    await registrarCusto(sb, { pedidoId: 'p', fonte: 'infosimples_detran_es', preco: 0.28, code: 200, bruto: { placa: 'X', proprietario: 'NOME' } })
    expect(linhas[0]).toMatchObject({ pedido_id: 'p', preco: 0.28, code: 200, bruto: { placa: 'X' } })
    expect(JSON.stringify(linhas[0])).not.toContain('NOME')
    semColuna = true
    await registrarCusto(sb, { pedidoId: 'p2', fonte: 'f', preco: 0.28, code: 200, detalhe: 'd', bruto: { a: 1 } })
    expect(linhas[1]).toEqual({ pedido_id: 'p2', fonte: 'f', preco: 0.28, code: 200, detalhe: 'd' })
  })
})
