// Servidor MCP remoto MINIMO (Streamable HTTP, so leitura) em cima do mesmo
// resolvedor do /llms (server/utils/llms-answer.ts). Publico como o /llms, sem
// auth. NAO expoe consulta de placa, relatorio, sinal de leilao/recall nem
// nada pago ou com dado de veiculo especifico: so FIPE por modelo, seguro
// medio (estado/modelo) e IBV, que ja sao publicos no /llms e nas paginas.
import { resolveLlmsQuery, renderLlmsText, type LlmsAnswer } from './llms-answer'

export const MCP_NOME = 'placacompleta-llms'
export const MCP_VERSAO = '1.0.0'
export const MCP_PROTOCOLOS = ['2025-06-18', '2025-03-26', '2024-11-05']
export const MCP_ENDPOINT = 'https://placacompleta.com.br/mcp'

type Cfg = { fipeApiToken?: string; fipeApiUrl?: string }

const texto = (v: unknown, max = 120) => (typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim().slice(0, max) : '')

export const MCP_FERRAMENTAS = [
  {
    name: 'valor_fipe',
    title: 'Valor FIPE por modelo',
    description: 'Valor da tabela FIPE de um modelo de carro (marca e modelo, ano opcional). Nao consulta placa.',
    inputSchema: {
      type: 'object',
      properties: {
        modelo: { type: 'string', description: 'Marca e modelo, ex.: "Volkswagen Gol" ou "Onix"' },
        ano: { type: 'integer', description: 'Ano do modelo (opcional), ex.: 2018' },
      },
      required: ['modelo'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    pergunta: (a: any) => `valor fipe ${texto(a?.modelo)} ${Number.isInteger(a?.ano) ? a.ano : ''}`.trim(),
  },
  {
    name: 'seguro_medio',
    title: 'Seguro medio por estado ou modelo',
    description: 'Custo medio anual estimado do seguro de carro por estado brasileiro ou por modelo (base SUSEP). Sem dado de veiculo especifico.',
    inputSchema: {
      type: 'object',
      properties: {
        estado: { type: 'string', description: 'Estado (nome ou sigla), ex.: "Rio de Janeiro" ou "SP"' },
        modelo: { type: 'string', description: 'Modelo do carro, ex.: "Jeep Compass"' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    pergunta: (a: any) => `seguro medio ${texto(a?.modelo)} ${texto(a?.estado, 40)}`.replace(/\s+/g, ' ').trim(),
  },
  {
    name: 'valorizacao_usados',
    title: 'Valorizacao de carros usados (IBV Auto)',
    description: 'Resumo do indice mais recente de valorizacao/desvalorizacao de carros usados no Brasil (IBV Auto).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    pergunta: () => 'valorizacao de carros usados ibv',
  },
] as const

export function listaFerramentas() {
  return MCP_FERRAMENTAS.map(({ pergunta: _p, ...t }) => t)
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any }
const erro = (id: any, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
const ok = (id: any, result: any) => ({ jsonrpc: '2.0', id, result })

/** Uma mensagem JSON-RPC. Notificacao (sem id) devolve null. */
export async function tratarMensagem(msg: Rpc, cfg: Cfg, onAnswer?: (a: LlmsAnswer) => void): Promise<any | null> {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return erro((msg as any)?.id, -32600, 'Invalid Request')
  }
  const notificacao = msg.id === undefined
  const { id, method, params } = msg
  if (notificacao) return null

  switch (method) {
    case 'initialize': {
      const pedida = String(params?.protocolVersion || '')
      return ok(id, {
        protocolVersion: MCP_PROTOCOLOS.includes(pedida) ? pedida : MCP_PROTOCOLOS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: MCP_NOME, title: 'PlacaCompleta (dados publicos para agentes)', version: MCP_VERSAO },
        instructions: 'Somente leitura: valor FIPE por modelo, seguro medio por estado/modelo e IBV Auto. Consulta por placa e relatorio completo ficam em https://placacompleta.com.br.',
      })
    }
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, { tools: listaFerramentas() })
    case 'tools/call': {
      const f = MCP_FERRAMENTAS.find((t) => t.name === params?.name)
      if (!f) return erro(id, -32602, `Ferramenta desconhecida: ${String(params?.name || '').slice(0, 60)}`)
      const args = params?.arguments && typeof params.arguments === 'object' ? params.arguments : {}
      const answer = await resolveLlmsQuery(f.pergunta(args), cfg)
      onAnswer?.(answer)
      return ok(id, {
        content: [{ type: 'text', text: renderLlmsText(answer) }],
        structuredContent: answer,
        isError: false,
      })
    }
    default:
      return erro(id, -32601, `Metodo nao suportado: ${method.slice(0, 60)}`)
  }
}
