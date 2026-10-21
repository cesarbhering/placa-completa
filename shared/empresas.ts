// Consultas em pacote para lojistas, garagens e despachantes (Cesar, 20/out/2026).
// Pagina /para-empresas + formulario de proposta (POST /api/empresas/proposta).
// Sem preco: o Cesar fecha caso a caso. Sem travessao, sem citar orgao federal.

export const TIPOS_EMPRESA = ['Lojista', 'Garagem', 'Despachante', 'Outro'] as const
export type TipoEmpresa = typeof TIPOS_EMPRESA[number]

export const VOLUMES_EMPRESA = ['até 20', '20 a 50', '50 a 200', 'mais de 200'] as const
export type VolumeEmpresa = typeof VOLUMES_EMPRESA[number]

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'] as const

export const MSG_RECEBIDO = 'Recebemos seu pedido. Respondemos em até 24 horas úteis.'

export interface PropostaEmpresa {
  nome: string
  empresa: string
  tipo: TipoEmpresa
  cidade: string
  uf: string
  volume_faixa: VolumeEmpresa
  whatsapp: string
  email: string
  mensagem: string | null
}

const limpo = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/** Valida e saneia o formulario. Devolve os dados ou o primeiro erro, ja em frase pra tela. */
export function validarProposta(b: any): { ok: true; dados: PropostaEmpresa } | { ok: false; erro: string; campo: string } {
  const nome = limpo(b?.nome, 120)
  const empresa = limpo(b?.empresa, 160)
  const tipo = limpo(b?.tipo, 20) as TipoEmpresa
  const cidade = limpo(b?.cidade, 120)
  const uf = limpo(b?.uf, 2).toUpperCase()
  const volume = limpo(b?.volume_faixa, 20) as VolumeEmpresa
  const whatsapp = String(b?.whatsapp ?? '').replace(/\D/g, '').slice(0, 13)
  const email = limpo(b?.email, 160).toLowerCase()
  const mensagem = String(b?.mensagem ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, 2000)
  if (nome.length < 2) return { ok: false, erro: 'Informe seu nome.', campo: 'nome' }
  if (empresa.length < 2) return { ok: false, erro: 'Informe o nome da empresa.', campo: 'empresa' }
  if (!TIPOS_EMPRESA.includes(tipo)) return { ok: false, erro: 'Escolha o tipo de empresa.', campo: 'tipo' }
  if (cidade.length < 2) return { ok: false, erro: 'Informe a cidade.', campo: 'cidade' }
  if (!(UFS as readonly string[]).includes(uf)) return { ok: false, erro: 'Escolha a UF.', campo: 'uf' }
  if (!VOLUMES_EMPRESA.includes(volume)) return { ok: false, erro: 'Escolha o volume estimado por mês.', campo: 'volume_faixa' }
  if (whatsapp.length < 10 || whatsapp.length > 13) return { ok: false, erro: 'Informe um WhatsApp com DDD.', campo: 'whatsapp' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: 'Informe um e-mail válido.', campo: 'email' }
  if (b?.aceite !== true) return { ok: false, erro: 'É preciso aceitar a política de privacidade.', campo: 'aceite' }
  return { ok: true, dados: { nome, empresa, tipo, cidade, uf, volume_faixa: volume, whatsapp, email, mensagem: mensagem || null } }
}

/** Assunto do e-mail ao Cesar. */
export function assuntoProposta(d: Pick<PropostaEmpresa, 'empresa' | 'tipo' | 'volume_faixa'>): string {
  return `Proposta de pacote: ${d.empresa} (${d.tipo}, ${d.volume_faixa} por mês)`
}

/** Corpo (texto) do e-mail ao Cesar. */
export function textoProposta(d: PropostaEmpresa, origem: string | null): string {
  return [
    'Pedido de proposta de consultas em pacote (placacompleta.com.br/para-empresas).',
    '',
    `Nome: ${d.nome}`,
    `Empresa: ${d.empresa}`,
    `Tipo: ${d.tipo}`,
    `Cidade: ${d.cidade}/${d.uf}`,
    `Volume estimado: ${d.volume_faixa} consultas por mês`,
    `WhatsApp: ${d.whatsapp}`,
    `E-mail: ${d.email}`,
    `Mensagem: ${d.mensagem || '(sem mensagem)'}`,
    `Origem: ${origem || 'direto'}`,
    '',
    'Prometemos resposta em até 24 horas úteis. O lead NAO recebe e-mail automatico.',
  ].join('\n')
}
